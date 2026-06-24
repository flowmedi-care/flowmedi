import type { SupabaseClient } from "@supabase/supabase-js";

export interface AssistantHealthCheck {
  assistantEnabled: boolean;
  migrationOk: boolean;
  migrationError: string | null;
  openaiConfigured: boolean;
  cronSecretConfigured: boolean;
  pendingInboundCount: number;
  stuckDebounceCount: number;
  blockedConversationCount: number;
  lastEventAt: string | null;
  lastEventStage: string | null;
}

export interface BlockedConversationRow {
  id: string;
  phone_number: string;
  ai_handoff_at: string | null;
  ai_enabled: boolean | null;
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

export interface AiToolLogRow {
  id: string;
  tool_name: string;
  success: boolean;
  result_summary: string | null;
  created_at: string;
}

export async function gatherAssistantDiagnostics(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{
  health: AssistantHealthCheck;
  events: AiEventRow[];
  toolLogs: AiToolLogRow[];
  blockedConversations: BlockedConversationRow[];
}> {
  const now = new Date().toISOString();

  const [
    settingsResult,
    pendingResult,
    stuckResult,
    lastEventResult,
    eventsResult,
    toolLogsResult,
    blockedResult,
  ] = await Promise.all([
    supabase
      .from("clinic_virtual_assistant_settings")
      .select("enabled")
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
      .is("ai_handoff_at", null),
    supabase
      .from("whatsapp_ai_event_log")
      .select("created_at, stage")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("whatsapp_ai_event_log")
      .select("id, stage, level, detail, conversation_id, message_id, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("whatsapp_ai_tool_log")
      .select("id, tool_name, success, result_summary, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, ai_handoff_at, ai_enabled")
      .eq("clinic_id", clinicId)
      .or("ai_handoff_at.not.is.null,ai_enabled.eq.false")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const migrationOk = !settingsResult.error;
  const migrationError = settingsResult.error?.message ?? null;
  const eventsTableMissing =
    eventsResult.error?.message?.includes("does not exist") ||
    eventsResult.error?.message?.includes("whatsapp_ai_event_log");

  const health: AssistantHealthCheck = {
    assistantEnabled: settingsResult.data?.enabled === true,
    migrationOk,
    migrationError,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    pendingInboundCount: pendingResult.count ?? 0,
    stuckDebounceCount: stuckResult.count ?? 0,
    blockedConversationCount: blockedResult.data?.length ?? 0,
    lastEventAt: lastEventResult.data?.created_at ?? null,
    lastEventStage: lastEventResult.data?.stage ?? null,
  };

  if (eventsTableMissing) {
    health.migrationOk = false;
    health.migrationError =
      health.migrationError ??
      "Tabela whatsapp_ai_event_log não existe — rode migration-whatsapp-ai-events.sql";
  }

  return {
    health,
    events: (eventsResult.data ?? []) as AiEventRow[],
    toolLogs: (toolLogsResult.data ?? []) as AiToolLogRow[],
    blockedConversations: (blockedResult.data ?? []) as BlockedConversationRow[],
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
    .neq("ai_enabled", false)
    .limit(50);

  const { data: pendingRows } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("clinic_id", clinicId)
    .eq("direction", "inbound")
    .is("ai_processed_at", null)
    .limit(100);

  const ids = new Set<string>();
  for (const c of debounced ?? []) ids.add(c.id);
  for (const row of pendingRows ?? []) {
    if (row.conversation_id && clinicConvIds.has(row.conversation_id)) {
      ids.add(row.conversation_id);
    }
  }
  return [...ids];
}
