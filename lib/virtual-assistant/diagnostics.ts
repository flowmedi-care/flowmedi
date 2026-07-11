import type { SupabaseClient } from "@supabase/supabase-js";
import { getCheckpointerRuntimeStatus, getCheckpointer } from "./langgraph/checkpointer";
import {
  buildMessageFlows,
  type ConversationMeta,
  type MessageFlowTrace,
} from "./diagnostics-flow";
import { gatherDataReadiness, type DataReadinessReport } from "./data-readiness";
import {
  gatherPipelineToolMetrics,
  type PipelineToolMetricRow,
} from "./pipeline-tool-metrics";

export interface AssistantHealthCheck {
  assistantEnabled: boolean;
  assistantSettingsExists: boolean;
  assistantInactiveReason: string | null;
  migrationOk: boolean;
  migrationError: string | null;
  openaiConfigured: boolean;
  transcribeConfigured: boolean;
  cronSecretConfigured: boolean;
  pendingInboundCount: number;
  pendingAudioCount: number;
  stuckDebounceCount: number;
  blockedConversationCount: number;
  lastEventAt: string | null;
  lastEventStage: string | null;
  useLanggraphPipeline: boolean;
  langgraphShadowMode: boolean;
  langgraphDbConfigured: boolean;
  langgraphDbHost: string | null;
  langgraphCheckpointerMode: "postgres" | "memory";
  langgraphCheckpointerError: string | null;
  langgraphDirectDbHostWarning: boolean;
  whatsappIntegrationType: string | null;
  whatsappPhoneNumberId: string | null;
  toolLogMetricsMigrationOk: boolean;
  toolLogMetricsMigrationHint: string | null;
}

export interface BlockedConversationRow {
  id: string;
  phone_number: string;
  ai_handoff_at: string | null;
  ai_enabled: boolean | null;
  ai_user_opt_out: boolean | null;
}

export interface AiEventRow {
  id: string;
  stage: string;
  level: string;
  detail: Record<string, unknown>;
  conversation_id: string | null;
  message_id: string | null;
  created_at: string;
}

const DIAGNOSTICS_RECENT_EVENT_LIMIT = 200;
const DIAGNOSTICS_ANCHOR_LIMIT = 40;
const DIAGNOSTICS_RELATED_EVENT_LIMIT = 400;

const EVENT_SELECT =
  "id, stage, level, detail, conversation_id, message_id, created_at";

function mergeEventsById(...groups: AiEventRow[][]): AiEventRow[] {
  const byId = new Map<string, AiEventRow>();
  for (const group of groups) {
    for (const event of group) {
      byId.set(event.id, event);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

async function fetchDiagnosticsEvents(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ events: AiEventRow[]; eventsError: string | null }> {
  const [recentResult, anchorResult] = await Promise.all([
    supabase
      .from("whatsapp_ai_event_log")
      .select(EVENT_SELECT)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(DIAGNOSTICS_RECENT_EVENT_LIMIT),
    supabase
      .from("whatsapp_ai_event_log")
      .select(EVENT_SELECT)
      .eq("clinic_id", clinicId)
      .in("stage", ["webhook_inbound", "simulate_inbound"])
      .order("created_at", { ascending: false })
      .limit(DIAGNOSTICS_ANCHOR_LIMIT),
  ]);

  const recentEvents = (recentResult.data ?? []) as AiEventRow[];
  const anchorEvents = (anchorResult.data ?? []) as AiEventRow[];

  if (recentResult.error) {
    return { events: recentEvents, eventsError: recentResult.error.message };
  }

  const conversationIds = [
    ...new Set(
      anchorEvents.map((e) => e.conversation_id).filter((id): id is string => Boolean(id))
    ),
  ];

  let relatedEvents: AiEventRow[] = [];
  if (conversationIds.length > 0 && anchorEvents.length > 0) {
    const oldestAnchorAt = anchorEvents.reduce((oldest, event) => {
      const ts = new Date(event.created_at).getTime();
      return ts < oldest ? ts : oldest;
    }, new Date(anchorEvents[0].created_at).getTime());

    const { data: relatedData } = await supabase
      .from("whatsapp_ai_event_log")
      .select(EVENT_SELECT)
      .eq("clinic_id", clinicId)
      .in("conversation_id", conversationIds)
      .gte("created_at", new Date(oldestAnchorAt).toISOString())
      .order("created_at", { ascending: false })
      .limit(DIAGNOSTICS_RELATED_EVENT_LIMIT);

    relatedEvents = (relatedData ?? []) as AiEventRow[];
  }

  return {
    events: mergeEventsById(recentEvents, anchorEvents, relatedEvents),
    eventsError: anchorResult.error?.message ?? null,
  };
}

export interface AiToolLogRow {
  id: string;
  tool_name: string;
  success: boolean;
  result_summary: string | null;
  created_at: string;
  conversation_id?: string | null;
  params?: Record<string, unknown>;
  block_reason?: string | null;
}

export interface RecentErrorRow {
  id: string;
  stage: string;
  level: string;
  created_at: string;
  conversation_id: string | null;
  detail: Record<string, unknown>;
}

export async function gatherAssistantDiagnostics(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{
  health: AssistantHealthCheck;
  events: AiEventRow[];
  flows: MessageFlowTrace[];
  conversationMeta: Record<string, ConversationMeta>;
  dataReadiness: DataReadinessReport;
  toolLogs: AiToolLogRow[];
  pipelineToolMetrics: PipelineToolMetricRow[];
  blockedConversations: BlockedConversationRow[];
  recentErrors: RecentErrorRow[];
}> {
  const now = new Date().toISOString();

  const [
    settingsResult,
    pendingResult,
    stuckResult,
    lastEventResult,
    toolLogsResult,
    toolLogMetricsProbe,
    blockedResult,
    pendingAudioResult,
    whatsappIntegrationResult,
  ] = await Promise.all([
    supabase
      .from("clinic_virtual_assistant_settings")
      .select("enabled, use_langgraph_pipeline, langgraph_shadow_mode")
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("direction", "inbound")
      .is("ai_processed_at", null),
    supabase
      .from("whatsapp_conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .not("ai_debounce_until", "is", null)
      .lt("ai_debounce_until", now)
      .is("ai_handoff_at", null)
      .eq("ai_user_opt_out", false),
    supabase
      .from("whatsapp_ai_event_log")
      .select("created_at, stage")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("whatsapp_ai_tool_log")
      .select("id, tool_name, success, result_summary, created_at, conversation_id, params, block_reason")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("whatsapp_ai_tool_log")
      .select("block_reason")
      .eq("clinic_id", clinicId)
      .limit(1),
    supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, ai_handoff_at, ai_enabled, ai_user_opt_out")
      .eq("clinic_id", clinicId)
      .or("ai_handoff_at.not.is.null,ai_enabled.eq.false,ai_user_opt_out.eq.true")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("direction", "inbound")
      .eq("message_type", "audio")
      .is("ai_processed_at", null),
    supabase
      .from("clinic_integrations")
      .select("integration_type, metadata")
      .eq("clinic_id", clinicId)
      .in("integration_type", ["whatsapp_meta", "whatsapp_simple"])
      .eq("status", "connected")
      .limit(1)
      .maybeSingle(),
  ]);

  const { events, eventsError } = await fetchDiagnosticsEvents(supabase, clinicId);

  const migrationOk = !settingsResult.error;
  const migrationError = settingsResult.error?.message ?? null;
  const eventsTableMissing =
    eventsError?.includes("does not exist") ||
    eventsError?.includes("whatsapp_ai_event_log");

  await getCheckpointer().catch(() => undefined);
  const checkpointerStatus = getCheckpointerRuntimeStatus();

  const settingsRow = settingsResult.data as
    | {
        enabled?: boolean;
        use_langgraph_pipeline?: boolean;
        langgraph_shadow_mode?: boolean;
      }
    | null;

  const whatsappIntegration = whatsappIntegrationResult.data as
    | { integration_type?: string; metadata?: { phone_number_id?: string } }
    | null;
  const assistantSettings = settingsRow;
  const assistantInactiveReason = !assistantSettings
    ? "sem registro de configuração"
    : assistantSettings.enabled !== true
      ? "enabled=false"
      : null;

  const toolLogMetricsError = toolLogMetricsProbe.error?.message ?? null;
  const toolLogMetricsMigrationOk =
    !toolLogMetricsError ||
    (!toolLogMetricsError.includes("block_reason") &&
      !toolLogMetricsError.includes("does not exist"));

  let toolLogsRows = (toolLogsResult.data ?? []) as AiToolLogRow[];
  if (
    toolLogsResult.error &&
    /block_reason|does not exist/i.test(toolLogsResult.error.message)
  ) {
    const { data: fallbackLogs } = await supabase
      .from("whatsapp_ai_tool_log")
      .select("id, tool_name, success, result_summary, created_at, conversation_id, params")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(200);
    toolLogsRows = (fallbackLogs ?? []) as AiToolLogRow[];
  }

  const health: AssistantHealthCheck = {
    assistantEnabled: assistantSettings?.enabled === true,
    assistantSettingsExists: Boolean(assistantSettings),
    assistantInactiveReason,
    migrationOk,
    migrationError,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    transcribeConfigured: Boolean(process.env.TRANSCRIBE_API_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    pendingInboundCount: pendingResult.count ?? 0,
    pendingAudioCount: pendingAudioResult.count ?? 0,
    stuckDebounceCount: stuckResult.count ?? 0,
    blockedConversationCount: blockedResult.data?.length ?? 0,
    lastEventAt: lastEventResult.data?.created_at ?? null,
    lastEventStage: lastEventResult.data?.stage ?? null,
    useLanggraphPipeline: settingsRow?.use_langgraph_pipeline === true,
    langgraphShadowMode: settingsRow?.langgraph_shadow_mode === true,
    langgraphDbConfigured: checkpointerStatus.dbConfigured,
    langgraphDbHost: checkpointerStatus.dbHost,
    langgraphCheckpointerMode: checkpointerStatus.mode,
    langgraphCheckpointerError: checkpointerStatus.initError,
    langgraphDirectDbHostWarning: checkpointerStatus.usesDirectSupabaseHost,
    whatsappIntegrationType: whatsappIntegration?.integration_type ?? null,
    whatsappPhoneNumberId:
      typeof whatsappIntegration?.metadata?.phone_number_id === "string"
        ? whatsappIntegration.metadata.phone_number_id
        : null,
    toolLogMetricsMigrationOk,
    toolLogMetricsMigrationHint: toolLogMetricsMigrationOk
      ? null
      : "Rode supabase/migration-pipeline-tool-log-metrics.sql para block_reason e pipeline_stage em whatsapp_ai_tool_log",
  };

  if (eventsTableMissing) {
    health.migrationOk = false;
    health.migrationError =
      health.migrationError ??
      "Tabela whatsapp_ai_event_log não existe — rode migration-whatsapp-ai-events.sql";
  }

  const recentErrors: RecentErrorRow[] = events
    .filter(
      (e) =>
        e.level === "error" ||
        e.stage === "error" ||
        e.stage === "langgraph_shadow_error" ||
        (e.stage === "audio_transcribe_failed")
    )
    .slice(0, 15)
    .map((e) => ({
      id: e.id,
      stage: e.stage,
      level: e.level,
      created_at: e.created_at,
      conversation_id: e.conversation_id,
      detail: e.detail,
    }));
  const conversationIds = [
    ...new Set(events.map((e) => e.conversation_id).filter((id): id is string => Boolean(id))),
  ];

  const messageIds = [
    ...new Set(events.map((e) => e.message_id).filter((id): id is string => Boolean(id))),
  ];

  const processedMessageIds = new Set<string>();
  if (messageIds.length > 0) {
    const { data: msgRows } = await supabase
      .from("whatsapp_messages")
      .select("id, ai_processed_at")
      .in("id", messageIds);
    for (const row of msgRows ?? []) {
      if (row.ai_processed_at) processedMessageIds.add(row.id);
    }
  }

  const conversationMeta: Record<string, ConversationMeta> = {};
  if (conversationIds.length > 0) {
    const { data: convRows } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, patient_id")
      .eq("clinic_id", clinicId)
      .in("id", conversationIds);

    const patientIds = [
      ...new Set((convRows ?? []).map((c) => c.patient_id).filter((id): id is string => Boolean(id))),
    ];

    const patientNames = new Map<string, string>();
    if (patientIds.length > 0) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, full_name")
        .in("id", patientIds);
      for (const p of patients ?? []) {
        if (p.full_name) patientNames.set(p.id, p.full_name);
      }
    }

    for (const c of convRows ?? []) {
      conversationMeta[c.id] = {
        phone: c.phone_number ?? "",
        patientName: c.patient_id ? patientNames.get(c.patient_id) ?? null : null,
      };
    }
  }

  const flows = buildMessageFlows(events, conversationMeta, processedMessageIds);
  const dataReadiness = await gatherDataReadiness(supabase, clinicId);
  const pipelineToolMetrics = await gatherPipelineToolMetrics(supabase, clinicId);

  return {
    health,
    events,
    flows,
    conversationMeta,
    dataReadiness,
    toolLogs: toolLogsRows,
    pipelineToolMetrics,
    blockedConversations: (blockedResult.data ?? []) as BlockedConversationRow[],
    recentErrors,
  };
}

export async function findClinicConversationIdsToProcess(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string[]> {
  const now = new Date().toISOString();

  const { data: clinicConvs } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("clinic_id", clinicId);

  const clinicConvIds = new Set((clinicConvs ?? []).map((c) => c.id));
  if (!clinicConvIds.size) return [];

  const { data: debounced } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("clinic_id", clinicId)
    .lte("ai_debounce_until", now)
    .is("ai_handoff_at", null)
    .eq("ai_user_opt_out", false)
    .neq("ai_enabled", false)
    .limit(50);

  const { data: pendingRows } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .limit(100);

  const { data: convsWithJobs } = await supabase
    .from("whatsapp_conversations")
    .select("id, ai_state")
    .eq("clinic_id", clinicId)
    .is("ai_handoff_at", null)
    .eq("ai_user_opt_out", false)
    .neq("ai_enabled", false);

  const ids = new Set<string>();
  for (const c of debounced ?? []) ids.add(c.id);
  for (const row of pendingRows ?? []) {
    if (row.conversation_id && clinicConvIds.has(row.conversation_id)) {
      ids.add(row.conversation_id);
    }
  }
  for (const c of convsWithJobs ?? []) {
    const jobs = (c.ai_state as { pending_transcription_jobs?: unknown[] } | null)
      ?.pending_transcription_jobs;
    if (Array.isArray(jobs) && jobs.length > 0 && clinicConvIds.has(c.id)) {
      ids.add(c.id);
    }
  }
  return [...ids];
}
