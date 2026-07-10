import type { AiEventRow } from "./diagnostics";

export type FlowStepStatus = "completed" | "in_progress" | "pending" | "failed" | "skipped";

export type FlowTraceStatus = "completed" | "in_progress" | "failed" | "blocked" | "skipped" | "discarded";

export interface ConversationMeta {
  phone: string;
  patientName: string | null;
}

export interface FlowStep {
  key: string;
  title: string;
  description?: string;
  status: FlowStepStatus;
  at?: string;
  detail?: Record<string, unknown>;
  events?: AiEventRow[];
}

export interface IntentTraceInfo {
  detectedIntent: string;
  intentConfidence?: number;
  intentSource?: string;
  continuityIntent?: string;
  bookingStep?: string;
  pipelineStage?: string;
  derivedStage?: string;
  journeyStepCode?: string;
  offeredSlotsCount?: number;
}

export interface MessageFlowTrace {
  id: string;
  conversationId: string | null;
  contactLabel: string;
  messagePreview: string;
  inboundFullText?: string;
  outboundFullText?: string;
  detectedIntent?: string;
  intentInfo?: IntentTraceInfo;
  channel: "text" | "audio" | "simulation" | "system";
  startedAt: string;
  finishedAt?: string;
  status: FlowTraceStatus;
  steps: FlowStep[];
  eventIds: string[];
}

const TRACE_WINDOW_MS = 15 * 60 * 1000;

function isNorthStarTrace(events: AiEventRow[]): boolean {
  return events.some(
    (e) =>
      e.stage === "north_star_complete" ||
      e.stage === "north_star_turn" ||
      (e.stage === "agent_route" && e.detail?.engine === "north_star") ||
      (e.stage === "openai_start" && e.detail?.engine === "north_star")
  );
}

function stepTitleForTrace(
  def: { key: string; title: string },
  events: AiEventRow[]
): string {
  if (!isNorthStarTrace(events)) return def.title;
  switch (def.key) {
    case "openai_send":
      return "North Star (turno)";
    case "openai_reply":
      return "Resposta North Star";
    case "pipeline":
      return "Pipeline North Star";
    default:
      return def.title;
  }
}

const TEXT_STEP_DEFS: { key: string; title: string; stages: string[] }[] = [
  { key: "received", title: "Mensagem recebida", stages: ["webhook_inbound", "simulate_inbound"] },
  { key: "routing", title: "Roteamento para IA", stages: ["routing_decision"] },
  { key: "debounce", title: "Aguardando debounce", stages: ["debounce_scheduled"] },
  { key: "processing", title: "Processamento iniciado", stages: ["processing_start", "cron_conversation_processed"] },
  { key: "openai_send", title: "Enviando para OpenAI", stages: ["openai_start", "langgraph_start"] },
  { key: "intent", title: "Intent detectada", stages: ["intent_classified", "langgraph_trace", "north_star_turn"] },
  {
    key: "pipeline",
    title: "Pipeline do agente",
    stages: [
      "pipeline_stage_enter",
      "pipeline_tool_blocked",
      "pipeline_confirmation_pending",
      "langgraph_complete",
      "langgraph_trace",
      "agent_route",
      "langgraph_shadow_compare",
      "north_star_complete",
      "north_star_turn",
      "north_star_shadow",
      "north_star_shadow_compare",
      "booking_continuity",
    ],
  },
  { key: "openai_reply", title: "Resposta da IA", stages: ["openai_end"] },
  { key: "whatsapp_send", title: "Enviando para o paciente", stages: ["reply_sent", "handoff"] },
  { key: "done", title: "Concluído", stages: [] },
];

const AUDIO_STEP_DEFS: { key: string; title: string; stages: string[] }[] = [
  { key: "received", title: "Áudio recebido", stages: ["webhook_inbound", "simulate_inbound"] },
  { key: "routing", title: "Roteamento para IA", stages: ["routing_decision"] },
  { key: "debounce", title: "Aguardando debounce", stages: ["debounce_scheduled"] },
  { key: "transcribe_start", title: "Enviando para transcrição", stages: ["audio_transcribe_start"] },
  {
    key: "transcribe_wait",
    title: "Aguardando transcrição (cron)",
    stages: ["pending_messages", "cron_conversation_processed"],
  },
  { key: "transcribe_ok", title: "Áudio transcrito", stages: ["audio_transcribe_ok"] },
  { key: "processing", title: "Processamento iniciado", stages: ["processing_start"] },
  { key: "openai_send", title: "Enviando para OpenAI", stages: ["openai_start"] },
  { key: "openai_reply", title: "Resposta da IA", stages: ["openai_end"] },
  { key: "whatsapp_send", title: "Enviando para o paciente", stages: ["reply_sent", "handoff"] },
  { key: "done", title: "Concluído", stages: [] },
];

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function contactLabel(
  conversationId: string | null,
  detail: Record<string, unknown>,
  meta: Record<string, ConversationMeta>
): string {
  const from = typeof detail.from === "string" ? detail.from : null;
  if (conversationId && meta[conversationId]?.patientName) {
    return meta[conversationId].patientName!;
  }
  if (conversationId && meta[conversationId]?.phone) {
    return formatPhone(meta[conversationId].phone);
  }
  if (from) return formatPhone(from);
  return "Contato";
}

function fullInboundText(detail: Record<string, unknown>): string | undefined {
  if (typeof detail.body === "string" && detail.body.trim()) return detail.body.trim();
  if (typeof detail.text === "string" && detail.text.trim()) return detail.text.trim();
  if (typeof detail.inbound_text === "string" && detail.inbound_text.trim()) {
    return detail.inbound_text.trim();
  }
  if (typeof detail.bodyPreview === "string" && detail.bodyPreview.trim()) {
    return detail.bodyPreview.trim();
  }
  if (typeof detail.textPreview === "string" && detail.textPreview.trim()) {
    return detail.textPreview.trim();
  }
  return undefined;
}

function messagePreview(anchor: AiEventRow): { preview: string; channel: MessageFlowTrace["channel"]; fullText?: string } {
  const detail = anchor.detail ?? {};
  if (anchor.stage === "simulate_inbound") {
    const text = typeof detail.textPreview === "string" ? detail.textPreview : "Simulação";
    const full = typeof detail.text === "string" ? detail.text : text;
    return { preview: `"${text}"`, channel: "simulation", fullText: full };
  }
  const msgType = typeof detail.msgType === "string" ? detail.msgType : "text";
  if (msgType === "audio") {
    return { preview: "🎤 Mensagem de áudio", channel: "audio" };
  }
  const fullText = fullInboundText(detail);
  const body = fullText ?? "";
  return { preview: body ? `"${body}"` : "(sem texto)", channel: "text", fullText: body || undefined };
}

function extractIntentInfo(events: AiEventRow[]): IntentTraceInfo | undefined {
  const classified = events.find((e) => e.stage === "intent_classified");
  const northStarTurn = events.find((e) => e.stage === "north_star_turn");
  const traceClassify = events.find(
    (e) => e.stage === "langgraph_trace" && e.detail?.node === "classify_intent"
  );
  const complete = events.find((e) => e.stage === "langgraph_complete");

  const d = classified?.detail ?? traceClassify?.detail ?? complete?.detail ?? {};
  const detectedIntent =
    (typeof d.detected_intent === "string" ? d.detected_intent : undefined) ??
    (typeof complete?.detail?.detected_intent === "string"
      ? complete.detail.detected_intent
      : undefined);

  if (!detectedIntent) return undefined;

  return {
    detectedIntent,
    intentConfidence:
      typeof d.intent_confidence === "number"
        ? d.intent_confidence
        : undefined,
    intentSource:
      typeof d.source === "string"
        ? d.source
        : northStarTurn
          ? "north_star"
          : undefined,
    continuityIntent:
      typeof d.continuity_intent === "string" ? d.continuity_intent : undefined,
    bookingStep:
      typeof d.booking_step_before === "string"
        ? d.booking_step_before
        : typeof d.booking_step === "string"
          ? d.booking_step
          : undefined,
    pipelineStage:
      typeof d.pipeline_stage_before === "string"
        ? d.pipeline_stage_before
        : typeof d.pipeline_stage === "string"
          ? d.pipeline_stage
          : undefined,
    derivedStage:
      typeof d.derived_stage === "string"
        ? d.derived_stage
        : typeof complete?.detail?.pipeline_stage === "string"
          ? complete.detail.pipeline_stage
          : undefined,
    journeyStepCode:
      typeof d.journey_step_code === "string"
        ? d.journey_step_code
        : typeof d.journey_step_code_before === "string"
          ? d.journey_step_code_before
          : undefined,
    offeredSlotsCount:
      typeof d.offered_slots_count === "number" ? d.offered_slots_count : undefined,
  };
}

function stepDescription(stepKey: string, event: AiEventRow | undefined): string | undefined {
  if (!event) return undefined;
  const d = event.detail ?? {};
  switch (stepKey) {
    case "received":
      return typeof d.from === "string" ? `De ${formatPhone(d.from)}` : undefined;
    case "routing": {
      if (d.skipMenu === false) {
        return typeof d.reason === "string" ? `Bloqueado: ${d.reason}` : "Não encaminhado para IA";
      }
      return "Encaminhado para o assistente virtual";
    }
    case "debounce":
      return typeof d.debounceSeconds === "number"
        ? `Aguardar ${d.debounceSeconds}s antes de processar`
        : undefined;
    case "transcribe_start":
      return typeof d.filename === "string" ? `Arquivo ${d.filename}` : "Job criado na API de transcrição";
    case "transcribe_wait":
      if (d.waitingForTranscription) return "Aguardando cron ou Processar fila";
      if (d.source === "cron") return "Cron processou a conversa";
      return undefined;
    case "transcribe_ok":
      return typeof d.preview === "string" ? `Texto: "${d.preview}"` : undefined;
    case "openai_reply":
      return typeof d.replyPreview === "string"
        ? d.replyPreview
        : typeof d.reply_preview === "string"
          ? d.reply_preview
          : undefined;
    case "intent": {
      const intent = typeof d.detected_intent === "string" ? d.detected_intent : null;
      const conf = typeof d.intent_confidence === "number" ? d.intent_confidence : null;
      const source = typeof d.source === "string" ? d.source : null;
      const parts: string[] = [];
      if (intent) parts.push(intent);
      if (conf !== null) parts.push(`${Math.round(conf * 100)}%`);
      if (source) parts.push(source);
      return parts.length ? parts.join(" · ") : undefined;
    }
    case "pipeline": {
      const replySource = typeof d.reply_source === "string" ? d.reply_source : null;
      const intent = typeof d.detected_intent === "string" ? d.detected_intent : null;
      const stage = typeof d.pipeline_stage === "string" ? d.pipeline_stage : null;
      const parts: string[] = [];
      if (stage) parts.push(`Etapa: ${stage}`);
      if (intent) parts.push(`Intent: ${intent}`);
      if (replySource) parts.push(`Origem: ${replySource}`);
      if (
        replySource === "compose_llm" &&
        (intent === "greeting" || intent === "booking" || intent === "availability_check")
      ) {
        parts.push("⚠ Resposta genérica via LLM (esperado subgrafo)");
      }
      if (typeof d.reply_preview === "string" && d.reply_preview) {
        parts.push(d.reply_preview);
      }
      return parts.length ? parts.join(" · ") : undefined;
    }
    case "whatsapp_send":
      if (d.type === "audio_fallback") return "Fallback: não entendi o áudio";
      if (d.type === "outside_hours") return "Fora do horário do bot";
      return typeof d.replyPreview === "string"
        ? d.replyPreview
        : typeof d.reply_preview === "string"
          ? d.reply_preview
          : "Mensagem enviada no WhatsApp";
    case "processing":
      if (d.skipped) return typeof d.reason === "string" ? `Ignorado: ${d.reason}` : "Assistente inativo";
      return typeof d.phone === "string" ? formatPhone(d.phone) : undefined;
    default:
      return undefined;
  }
}

function eventMatchesStep(event: AiEventRow, step: { key: string; stages: string[] }): boolean {
  if (!step.stages.includes(event.stage)) return false;
  if (step.key === "transcribe_wait") {
    if (event.stage === "pending_messages") {
      return Boolean(event.detail?.waitingForTranscription);
    }
    return event.stage === "cron_conversation_processed";
  }
  if (step.key === "processing" && event.stage === "cron_conversation_processed") {
    return false;
  }
  return true;
}

function stepFailed(event: AiEventRow): boolean {
  if (event.level === "error") return true;
  if (event.stage === "audio_transcribe_failed" || event.stage === "audio_no_media") return true;
  if (event.stage === "routing_decision" && event.detail?.skipMenu === false) return true;
  if (event.stage === "legacy_menu_no_reply") return true;
  if (event.stage === "processing_start" && event.detail?.skipped) return true;
  if (event.stage === "error") return true;
  if (
    event.stage === "langgraph_complete" &&
    event.detail?.reply_source === "compose_llm" &&
    (event.detail?.detected_intent === "greeting" ||
      event.detail?.detected_intent === "booking" ||
      event.detail?.detected_intent === "availability_check")
  ) {
    return true;
  }
  return false;
}

function eventsForStep(events: AiEventRow[], step: { key: string; stages: string[] }): AiEventRow[] {
  return events.filter((e) => {
    if (step.key === "intent") {
      if (e.stage === "intent_classified") return true;
      if (e.stage === "north_star_turn" && e.detail?.detected_intent) return true;
      if (e.stage === "langgraph_trace" && e.detail?.node === "classify_intent") return true;
      return false;
    }
    if (step.key === "pipeline") {
      return step.stages.includes(e.stage) && !(e.stage === "langgraph_trace" && e.detail?.node === "classify_intent");
    }
    return eventMatchesStep(e, step);
  });
}

function pickEventForStep(
  events: AiEventRow[],
  step: { key: string; stages: string[] }
): AiEventRow | undefined {
  if (step.key === "intent") {
    return (
      events.find((e) => e.stage === "intent_classified") ??
      events.find((e) => e.stage === "langgraph_trace" && e.detail?.node === "classify_intent")
    );
  }
  if (step.key === "pipeline" && isNorthStarTrace(events)) {
    return (
      events.find((e) => e.stage === "north_star_complete") ??
      events.find((e) => e.stage === "agent_route" && e.detail?.engine === "north_star") ??
      events.find((e) => e.stage === "north_star_turn") ??
      events.find((e) => step.stages.includes(e.stage))
    );
  }
  if (step.key === "transcribe_ok") {
    return events.find((e) => e.stage === "audio_transcribe_ok");
  }
  if (step.key === "pipeline") {
    return (
      events.find((e) => e.stage === "langgraph_complete") ??
      events.find((e) => e.stage === "langgraph_trace" && e.detail?.node === "run_complete") ??
      events.find((e) => e.stage === "agent_route") ??
      events.find((e) => step.stages.includes(e.stage))
    );
  }
  if (step.key === "transcribe_fail") {
    return events.find(
      (e) =>
        e.stage === "audio_transcribe_failed" ||
        e.stage === "audio_no_media"
    );
  }
  return events.find((e) => eventMatchesStep(e, step));
}

function buildSteps(
  events: AiEventRow[],
  channel: MessageFlowTrace["channel"]
): FlowStep[] {
  const defs = channel === "audio" ? AUDIO_STEP_DEFS : TEXT_STEP_DEFS;
  const transcribeFailed = events.find(
    (e) => e.stage === "audio_transcribe_failed" || e.stage === "audio_no_media"
  );
  const hasReply = events.some((e) => e.stage === "reply_sent" || e.stage === "handoff");
  const hasError = events.some((e) => e.stage === "error");
  const routingBlocked = events.some(
    (e) =>
      (e.stage === "routing_decision" && e.detail?.skipMenu === false) ||
      e.stage === "legacy_menu_no_reply"
  );

  const steps: FlowStep[] = [];
  let lastCompletedIndex = -1;

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (def.key === "done") continue;

    const event = pickEventForStep(events, def);
    let status: FlowStepStatus = "pending";

    if (event) {
      status = stepFailed(event) ? "failed" : "completed";
      lastCompletedIndex = i;
    }

    steps.push({
      key: def.key,
      title: stepTitleForTrace(def, events),
      description: stepDescription(def.key, event),
      status,
      at: event?.created_at,
      detail: event?.detail,
      events: eventsForStep(events, def),
    });
  }

  if (transcribeFailed && channel === "audio") {
    const failIdx = steps.findIndex((s) => s.key === "transcribe_ok");
    if (failIdx >= 0) {
      steps[failIdx] = {
        key: "transcribe_fail",
        title: "Falha na transcrição",
        description:
          typeof transcribeFailed.detail?.reason === "string"
            ? String(transcribeFailed.detail.reason)
            : "Não foi possível transcrever o áudio",
        status: "failed",
        at: transcribeFailed.created_at,
        detail: transcribeFailed.detail,
      };
      for (let j = failIdx + 1; j < steps.length; j++) {
        if (steps[j].status === "pending") steps[j].status = "skipped";
      }
    }
  }

  if (routingBlocked) {
    const routingIdx = steps.findIndex((s) => s.key === "routing");
    if (routingIdx >= 0) {
      for (let j = routingIdx + 1; j < steps.length; j++) {
        if (steps[j].status === "pending") steps[j].status = "skipped";
      }
    }
  }

  inferRoutingFromLaterSteps(steps, events);

  if (hasReply) {
    const sendIdx = steps.findIndex((s) => s.key === "whatsapp_send");
    if (sendIdx >= 0) steps[sendIdx].status = "completed";
    steps.push({
      key: "done",
      title: "Concluído",
      description: "Fluxo finalizado com sucesso",
      status: "completed",
      at: events.find((e) => e.stage === "reply_sent" || e.stage === "handoff")?.created_at,
    });
    return steps;
  }

  if (hasError && !hasReply) {
    const err = events.find((e) => e.stage === "error");
    const failIdx = steps.findIndex((s) => s.status === "pending");
    if (failIdx >= 0 && err) {
      steps[failIdx] = {
        ...steps[failIdx],
        status: "failed",
        description:
          typeof err.detail?.message === "string"
            ? err.detail.message
            : "Erro no processamento",
        at: err.created_at,
      };
      for (let j = failIdx + 1; j < steps.length; j++) {
        steps[j].status = "skipped";
      }
    }
    return steps;
  }

  const firstPending = steps.findIndex((s) => s.status === "pending");
  if (firstPending >= 0 && !routingBlocked && !transcribeFailed) {
    steps[firstPending].status = "in_progress";
  }

  if (lastCompletedIndex >= 0 && firstPending < 0 && !hasReply) {
    steps.push({
      key: "done",
      title: "Concluído",
      status: "completed",
      at: steps[lastCompletedIndex].at,
    });
  }

  return steps;
}

function traceStatus(
  steps: FlowStep[],
  events: AiEventRow[],
  discarded: boolean
): FlowTraceStatus {
  if (discarded) return "discarded";
  if (events.some((e) => e.stage === "reply_sent" || e.stage === "handoff")) return "completed";
  if (
    events.some(
      (e) =>
        e.stage === "legacy_menu_no_reply" ||
        (e.stage === "routing_decision" && e.detail?.skipMenu === false)
    )
  ) {
    return "blocked";
  }
  if (
    events.some(
      (e) =>
        e.stage === "error" ||
        e.stage === "audio_transcribe_failed" ||
        e.stage === "audio_no_media"
    )
  ) {
    return "failed";
  }
  if (steps.some((s) => s.status === "in_progress")) return "in_progress";
  if (steps.every((s) => s.status === "skipped" || s.status === "failed")) return "failed";
  return "in_progress";
}

function isDiscardedTrace(events: AiEventRow[], anchorMessageProcessed: boolean): boolean {
  if (events.some((e) => e.stage === "flow_discarded")) return true;
  if (events.some((e) => e.stage === "queue_cleared")) return true;
  if (
    events.some(
      (e) => e.stage === "processing_start" && e.detail?.skipped === true
    )
  ) {
    return true;
  }
  const routing = events.find((e) => e.stage === "routing_decision");
  if (routing?.detail?.skipMenu === false) {
    const reason = typeof routing.detail?.reason === "string" ? routing.detail.reason : "";
    if (
      reason.includes("inativo") ||
      reason.includes("enabled=false") ||
      reason.includes("sem registro")
    ) {
      return true;
    }
  }
  if (anchorMessageProcessed) {
    const hasReply = events.some((e) => e.stage === "reply_sent" || e.stage === "handoff");
    if (!hasReply) return true;
  }
  return false;
}

function discardReason(events: AiEventRow[]): string {
  const discarded = events.find((e) => e.stage === "flow_discarded");
  if (discarded && typeof discarded.detail?.reason === "string") {
    return discarded.detail.reason;
  }
  const skipped = events.find(
    (e) => e.stage === "processing_start" && e.detail?.skipped === true
  );
  if (skipped && typeof skipped.detail?.reason === "string") {
    return `Assistente inativo: ${skipped.detail.reason}`;
  }
  const routing = events.find((e) => e.stage === "routing_decision");
  if (routing?.detail?.skipMenu === false && typeof routing.detail?.reason === "string") {
    return routing.detail.reason;
  }
  if (events.some((e) => e.stage === "queue_cleared")) {
    return "Fila zerada — não receberá resposta da IA";
  }
  return "Descartado da fila — não receberá resposta da IA";
}

function applyDiscardedSteps(steps: FlowStep[], reason: string, at?: string): FlowStep[] {
  const received = steps.find((s) => s.key === "received");
  const result: FlowStep[] = received ? [received] : [];
  result.push({
    key: "discarded",
    title: "Descartado — sem resposta da IA",
    description: reason,
    status: "completed",
    at,
  });
  return result;
}

function buildAnchorTrace(
  anchor: AiEventRow,
  events: AiEventRow[],
  meta: Record<string, ConversationMeta>,
  processedMessageIds: Set<string>
): MessageFlowTrace {
  const { preview, channel, fullText } = messagePreview(anchor);
  const intentInfo = extractIntentInfo(events);
  const replyEvent = events.find((e) => e.stage === "reply_sent" || e.stage === "handoff");
  const outboundFullText =
    typeof replyEvent?.detail?.replyPreview === "string"
      ? replyEvent.detail.replyPreview
      : typeof replyEvent?.detail?.reply_preview === "string"
        ? replyEvent.detail.reply_preview
        : undefined;
  const anchorProcessed = Boolean(anchor.message_id && processedMessageIds.has(anchor.message_id));
  const discarded = isDiscardedTrace(events, anchorProcessed);
  let steps = buildSteps(events, channel);
  if (discarded) {
    const discardAt =
      events.find((e) => e.stage === "flow_discarded")?.created_at ??
      events.find((e) => e.stage === "queue_cleared")?.created_at ??
      events.find((e) => e.stage === "processing_start" && e.detail?.skipped)?.created_at;
    steps = applyDiscardedSteps(steps, discardReason(events), discardAt);
  }
  const finished = events.find((e) => e.stage === "reply_sent" || e.stage === "handoff");

  return {
    id: anchor.id,
    conversationId: anchor.conversation_id,
    contactLabel: contactLabel(anchor.conversation_id, anchor.detail ?? {}, meta),
    messagePreview: preview,
    inboundFullText: fullText,
    outboundFullText,
    detectedIntent: intentInfo?.detectedIntent,
    intentInfo,
    channel,
    startedAt: anchor.created_at,
    finishedAt: discarded
      ? events.find((e) => e.stage === "flow_discarded")?.created_at ?? anchor.created_at
      : finished?.created_at,
    status: traceStatus(steps, events, discarded),
    steps,
    eventIds: events.map((e) => e.id),
  };
}

function buildSystemTrace(event: AiEventRow): MessageFlowTrace {
  const titles: Record<string, string> = {
    queue_cleared: "Fila da IA zerada manualmente",
    flow_discarded: "Mensagem descartada da fila da IA",
    ai_reactivated: "IA reativada na conversa",
    context_cleared: "Contexto da conversa limpo",
    cron_conversation_processed: "Conversa processada pelo cron",
  };
  const title = titles[event.stage] ?? event.stage;

  return {
    id: event.id,
    conversationId: event.conversation_id,
    contactLabel: "Sistema",
    messagePreview: title,
    channel: "system",
    startedAt: event.created_at,
    finishedAt: event.created_at,
    status: "completed",
    steps: [
      {
        key: "system",
        title,
        description: JSON.stringify(event.detail ?? {}).slice(0, 120),
        status: event.level === "error" ? "failed" : "completed",
        at: event.created_at,
        detail: event.detail,
      },
    ],
    eventIds: [event.id],
  };
}

function findAnchorForEvent(event: AiEventRow, anchors: AiEventRow[]): AiEventRow | undefined {
  if (event.stage === "webhook_inbound" || event.stage === "simulate_inbound") {
    return anchors.find((a) => a.id === event.id);
  }

  if (event.message_id) {
    const byMessage = anchors.find((a) => a.message_id === event.message_id);
    if (byMessage) return byMessage;
  }

  const convId = event.conversation_id;
  if (!convId) return undefined;

  const eventTime = new Date(event.created_at).getTime();
  const convAnchors = anchors
    .filter((a) => a.conversation_id === convId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (let i = 0; i < convAnchors.length; i++) {
    const anchor = convAnchors[i];
    const anchorTime = new Date(anchor.created_at).getTime();
    const nextTime =
      i + 1 < convAnchors.length
        ? new Date(convAnchors[i + 1].created_at).getTime()
        : anchorTime + TRACE_WINDOW_MS;

    if (eventTime >= anchorTime && eventTime < nextTime) {
      return anchor;
    }
  }

  return undefined;
}

function assignEventsToAnchors(
  anchors: AiEventRow[],
  sorted: AiEventRow[]
): Map<string, AiEventRow[]> {
  const byAnchor = new Map<string, AiEventRow[]>();
  for (const anchor of anchors) {
    byAnchor.set(anchor.id, [anchor]);
  }

  for (const event of sorted) {
    if (event.stage === "webhook_inbound" || event.stage === "simulate_inbound") continue;

    const anchor = findAnchorForEvent(event, anchors);
    if (!anchor) continue;

    const bucket = byAnchor.get(anchor.id);
    if (bucket && !bucket.some((e) => e.id === event.id)) {
      bucket.push(event);
    }
  }

  for (const bucket of byAnchor.values()) {
    bucket.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  return byAnchor;
}

function inferRoutingFromLaterSteps(steps: FlowStep[], events: AiEventRow[]): void {
  const routingIdx = steps.findIndex((s) => s.key === "routing");
  if (routingIdx < 0 || steps[routingIdx].status !== "pending") return;

  const debounce = events.find((e) => e.stage === "debounce_scheduled");
  const processing = events.find((e) => e.stage === "processing_start");
  const transcribe = events.find((e) => e.stage === "audio_transcribe_start");

  if (debounce || processing || transcribe) {
    steps[routingIdx] = {
      ...steps[routingIdx],
      status: "completed",
      description: "Encaminhado para o assistente virtual",
      at: debounce?.created_at ?? processing?.created_at ?? transcribe?.created_at,
    };
  }
}

function buildSyntheticAnchors(events: AiEventRow[]): AiEventRow[] {
  const synthetics: AiEventRow[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (event.stage !== "pending_messages") continue;
    const preview = event.detail?.preview;
    if (!Array.isArray(preview) || preview.length === 0) continue;

    const key = `${event.conversation_id ?? "none"}:${event.created_at}`;
    if (seen.has(key)) continue;
    seen.add(key);

    synthetics.push({
      ...event,
      id: `synthetic-${event.id}`,
      stage: "webhook_inbound",
      detail: {
        from:
          typeof event.detail?.phone === "string"
            ? event.detail.phone
            : "desconhecido",
        msgType: "text",
        bodyPreview: String(preview[0]).slice(0, 80),
        syntheticAnchor: true,
      },
    });
  }

  return synthetics;
}

/**
 * Agrupa eventos brutos em fluxos legíveis (texto, áudio ou sistema).
 */
export function buildMessageFlows(
  events: AiEventRow[],
  conversationMeta: Record<string, ConversationMeta>,
  processedMessageIds: Set<string> = new Set()
): MessageFlowTrace[] {
  if (!events.length) return [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let anchors = sorted.filter(
    (e) => e.stage === "webhook_inbound" || e.stage === "simulate_inbound"
  );

  if (anchors.length === 0) {
    anchors = buildSyntheticAnchors(sorted);
  }

  const eventsByAnchor = assignEventsToAnchors(anchors, sorted);
  const assignedIds = new Set<string>();
  const flows: MessageFlowTrace[] = [];

  for (const anchor of anchors) {
    const slice = eventsByAnchor.get(anchor.id) ?? [anchor];
    slice.forEach((e) => assignedIds.add(e.id));
    flows.push(buildAnchorTrace(anchor, slice, conversationMeta, processedMessageIds));
  }

  const systemStages = new Set(["queue_cleared", "ai_reactivated", "flow_discarded", "context_cleared"]);
  for (const event of sorted) {
    if (assignedIds.has(event.id)) continue;
    if (systemStages.has(event.stage)) {
      assignedIds.add(event.id);
      flows.push(buildSystemTrace(event));
    }
  }

  return flows.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}
