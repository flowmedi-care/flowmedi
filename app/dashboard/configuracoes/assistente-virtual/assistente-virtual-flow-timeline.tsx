"use client";

import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  MinusCircle,
  MessageSquare,
  Mic,
  FlaskConical,
  Settings2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiEventRow } from "@/lib/virtual-assistant/diagnostics";
import type {
  FlowStep,
  FlowStepStatus,
  FlowTraceStatus,
  IntentTraceInfo,
  MessageFlowTrace,
} from "@/lib/virtual-assistant/diagnostics-flow";
import {
  getIntentColorClass,
  getIntentLabel,
  getIntentSourceLabel,
  isIntentMismatch,
  isLowConfidenceIntent,
} from "@/lib/virtual-assistant/intent-labels";

const TRACE_STATUS: Record<
  FlowTraceStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }
> = {
  completed: { label: "Concluído", variant: "success" },
  in_progress: { label: "Em andamento", variant: "warning" },
  failed: { label: "Falhou", variant: "destructive" },
  blocked: { label: "Bloqueado", variant: "secondary" },
  skipped: { label: "Ignorado", variant: "outline" },
  discarded: { label: "Descartado", variant: "outline" },
};

function channelIcon(channel: MessageFlowTrace["channel"]) {
  switch (channel) {
    case "audio":
      return Mic;
    case "simulation":
      return FlaskConical;
    case "system":
      return Settings2;
    default:
      return MessageSquare;
  }
}

function stepIcon(status: FlowStepStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "skipped":
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const INITIAL_FLOW_LIMIT = 5;

const STAGE_LABELS: Record<string, string> = {
  webhook_inbound: "Mensagem recebida (webhook)",
  routing_decision: "Decisão de roteamento",
  legacy_menu_no_reply: "Menu legado sem resposta",
  debounce_scheduled: "IA agendada (debounce)",
  processing_start: "Processamento iniciado",
  pending_messages: "Mensagens pendentes",
  openai_start: "Chamada OpenAI",
  openai_end: "Resposta OpenAI",
  reply_sent: "Resposta enviada",
  handoff: "Transferido para humano",
  ai_reactivated: "IA reativada na conversa",
  audio_transcribe_start: "Transcrição de áudio iniciada",
  audio_transcribe_ok: "Áudio transcrito",
  audio_transcribe_failed: "Falha na transcrição",
  audio_no_media: "Áudio sem mídia salva",
  queue_cleared: "Fila da IA zerada",
  flow_discarded: "Descartado da fila",
  cron_conversation_processed: "Processado pelo cron",
  simulate_inbound: "Simulação inbound",
  error: "Erro",
  langgraph_start: "LangGraph iniciado",
  langgraph_complete: "LangGraph concluído",
  langgraph_trace: "Trace LangGraph",
  agent_route: "Roteamento do motor",
  langgraph_shadow_compare: "Shadow compare",
  langgraph_shadow_error: "Erro LangGraph (shadow)",
  booking_continuity: "Continuidade de agendamento",
  intent_classified: "Intent classificada",
  context_cleared: "Contexto limpo",
};

function IntentHighlightBadge({ info }: { info: IntentTraceInfo }) {
  const lowConf = isLowConfidenceIntent(info.intentConfidence);
  const mismatch = isIntentMismatch(info.detectedIntent, info.continuityIntent);
  const alert = lowConf || mismatch || info.detectedIntent === "unknown";

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border-2 p-3",
        alert ? "border-amber-400 bg-amber-50/80" : "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
            getIntentColorClass(info.detectedIntent)
          )}
        >
          {getIntentLabel(info.detectedIntent)}
        </span>
        {info.intentConfidence !== undefined && (
          <Badge variant={lowConf ? "destructive" : "secondary"}>
            {Math.round(info.intentConfidence * 100)}%
          </Badge>
        )}
        {info.intentSource && (
          <Badge variant="outline">{getIntentSourceLabel(info.intentSource)}</Badge>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {info.bookingStep && (
          <Badge variant="outline" className="font-normal">
            booking_step: {info.bookingStep}
          </Badge>
        )}
        {info.pipelineStage && (
          <Badge variant="outline" className="font-normal">
            pipeline: {info.pipelineStage}
          </Badge>
        )}
        {info.offeredSlotsCount !== undefined && info.offeredSlotsCount > 0 && (
          <Badge variant="outline" className="font-normal">
            {info.offeredSlotsCount} horário(s) oferecidos
          </Badge>
        )}
      </div>
      {lowConf && (
        <p className="mt-2 text-xs font-medium text-amber-800">Confiança baixa — verifique se a intent está correta.</p>
      )}
      {mismatch && (
        <p className="mt-1 text-xs font-medium text-red-700">
          Continuity ({info.continuityIntent}) ≠ intent detectada ({info.detectedIntent})
        </p>
      )}
    </div>
  );
}

function StepEventLogs({ step }: { step: FlowStep }) {
  const [expanded, setExpanded] = useState(false);
  const events = step.events ?? [];
  if (events.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Log ({events.length} evento{events.length === 1 ? "" : "s"})
      </button>
      {expanded && (
        <ul className="mt-1 space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="rounded-md border bg-muted/30 p-2">
              <p className="text-xs font-mono text-muted-foreground">
                {STAGE_LABELS[ev.stage] ?? ev.stage} · {formatTime(ev.created_at)}
              </p>
              <pre className="mt-1 max-h-48 overflow-auto text-xs">
                {JSON.stringify({ level: ev.level, stage: ev.stage, ...ev.detail }, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildDebugBundle(trace: MessageFlowTrace, traceEvents: AiEventRow[]): string {
  return JSON.stringify(
    {
      contact: trace.contactLabel,
      conversationId: trace.conversationId,
      inbound: trace.inboundFullText ?? trace.messagePreview,
      outbound: trace.outboundFullText,
      intent: trace.intentInfo,
      status: trace.status,
      startedAt: trace.startedAt,
      finishedAt: trace.finishedAt,
      steps: trace.steps.map((s) => ({
        key: s.key,
        title: s.title,
        status: s.status,
        description: s.description,
        detail: s.detail,
        events: (s.events ?? []).map((e) => ({
          stage: e.stage,
          level: e.level,
          created_at: e.created_at,
          detail: e.detail,
        })),
      })),
      events: traceEvents.map((e) => ({
        stage: e.stage,
        level: e.level,
        created_at: e.created_at,
        detail: e.detail,
      })),
    },
    null,
    2
  );
}

function FlowTraceCard({
  trace,
  rawEvents,
}: {
  trace: MessageFlowTrace;
  rawEvents: AiEventRow[];
}) {
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = channelIcon(trace.channel);
  const status = TRACE_STATUS[trace.status];

  const traceEvents = rawEvents.filter((e) => trace.eventIds.includes(e.id));
  const completedSteps = trace.steps.filter((s) => s.status === "completed").length;
  const activeStep = trace.steps.find((s) => s.status === "in_progress" || s.status === "failed");

  async function copyDebug() {
    try {
      await navigator.clipboard.writeText(buildDebugBundle(trace, traceEvents));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <header
        className="flex cursor-pointer flex-wrap items-start justify-between gap-3 bg-muted/30 px-4 py-3"
        onClick={() => setStepsExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setStepsExpanded((v) => !v);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={stepsExpanded}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              trace.channel === "audio" && "bg-violet-100 text-violet-700",
              trace.channel === "text" && "bg-sky-100 text-sky-700",
              trace.channel === "simulation" && "bg-amber-100 text-amber-700",
              trace.channel === "system" && "bg-slate-100 text-slate-700"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{trace.contactLabel}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
              {trace.detectedIntent && (
                <Badge
                  variant="outline"
                  className={cn("font-medium", getIntentColorClass(trace.detectedIntent))}
                >
                  {getIntentLabel(trace.detectedIntent)}
                </Badge>
              )}
              {trace.channel === "audio" && (
                <Badge variant="outline" className="border-violet-200 text-violet-700">
                  Áudio
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
              {trace.inboundFullText ?? trace.messagePreview}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(trace.startedAt).toLocaleString("pt-BR")}
              {trace.finishedAt && (
                <>
                  {" "}
                  <ArrowRight className="mx-0.5 inline h-3 w-3" />
                  {formatTime(trace.finishedAt)}
                </>
              )}
            </p>
            {!stepsExpanded && (
              <p className="text-xs text-muted-foreground">
                {completedSteps}/{trace.steps.length} passos
                {activeStep ? ` · ${activeStep.title}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {stepsExpanded && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                void copyDebug();
              }}
            >
              {copied ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied ? "Copiado" : "Copiar debug"}
            </Button>
          )}
          <span className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground">
            {stepsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {stepsExpanded ? "Recolher" : "Expandir"}
          </span>
        </div>
      </header>

      {stepsExpanded && (
      <div className="border-t px-4 py-4">
        <ol className="relative space-y-0">
          {trace.steps.map((step, index) => {
            const isLast = index === trace.steps.length - 1;
            return (
              <li key={`${trace.id}-${step.key}`} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && (
                  <span
                    className={cn(
                      "absolute left-[7px] top-5 h-[calc(100%-4px)] w-px",
                      step.status === "completed" ? "bg-green-300" : "bg-border"
                    )}
                    aria-hidden
                  />
                )}
                <div className="relative z-10 mt-0.5 shrink-0 bg-card">{stepIcon(step.status)}</div>
                <div className="min-w-0 flex-1 pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.status === "pending" && "text-muted-foreground",
                        step.status === "skipped" && "text-muted-foreground line-through",
                        step.status === "failed" && "text-red-700"
                      )}
                    >
                      {step.title}
                    </p>
                    {step.at && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatTime(step.at)}
                      </span>
                    )}
                  </div>
                  {step.key === "intent" && step.detail && trace.intentInfo && (
                    <IntentHighlightBadge info={trace.intentInfo} />
                  )}
                  {step.description && step.key !== "intent" && (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                  {step.key === "intent" && !trace.intentInfo && step.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                  )}
                  <StepEventLogs step={step} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      )}

      {stepsExpanded && traceEvents.length > 0 && (
        <footer className="border-t bg-muted/20 px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRawExpanded((v) => !v);
            }}
            className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {rawExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Eventos brutos ({traceEvents.length})
          </button>
          {rawExpanded && (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {traceEvents.map((ev) => (
                <li key={ev.id} className="rounded-md bg-background px-2 py-1.5 text-xs">
                  <p className="font-mono text-muted-foreground">
                    {STAGE_LABELS[ev.stage] ?? ev.stage}
                    <span className="mx-2">·</span>
                    {formatTime(ev.created_at)}
                  </p>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2">
                    {JSON.stringify({ level: ev.level, stage: ev.stage, ...ev.detail }, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </footer>
      )}
    </article>
  );
}

interface Props {
  flows: MessageFlowTrace[];
  events: AiEventRow[];
  showRaw: boolean;
  onToggleRaw: (show: boolean) => void;
}

function levelDot(level: string): string {
  if (level === "error") return "bg-red-500";
  if (level === "warn") return "bg-amber-500";
  return "bg-green-500";
}

export function AssistenteVirtualFlowTimeline({ flows, events, showRaw, onToggleRaw }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllFlows, setShowAllFlows] = useState(false);

  const visibleFlows = showAllFlows ? flows : flows.slice(0, INITIAL_FLOW_LIMIT);
  const hiddenFlowCount = flows.length - INITIAL_FLOW_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <ButtonTab active={!showRaw} onClick={() => onToggleRaw(false)}>
            Fluxos ({flows.length})
          </ButtonTab>
          <ButtonTab active={showRaw} onClick={() => onToggleRaw(true)}>
            Eventos brutos ({events.length})
          </ButtonTab>
        </div>
      </div>

      {!showRaw ? (
        flows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum fluxo recente. Envie uma mensagem ou áudio pelo WhatsApp para ver o passo a passo aqui.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleFlows.map((trace) => (
              <FlowTraceCard key={trace.id} trace={trace} rawEvents={events} />
            ))}
            {hiddenFlowCount > 0 && !showAllFlows && (
              <button
                type="button"
                onClick={() => setShowAllFlows(true)}
                className="w-full rounded-lg border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                Ver mais {hiddenFlowCount} fluxo{hiddenFlowCount === 1 ? "" : "s"}
              </button>
            )}
            {showAllFlows && flows.length > INITIAL_FLOW_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllFlows(false)}
                className="w-full rounded-lg border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                Mostrar menos
              </button>
            )}
          </div>
        )
      ) : (
        <ul className="max-h-[min(28rem,60vh)] space-y-2 overflow-y-auto pr-1">
          {events.map((ev) => (
            <li key={ev.id} className="rounded-lg border bg-card p-3 text-sm">
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot(ev.level)}`} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{STAGE_LABELS[ev.stage] ?? ev.stage}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                  </span>
                </span>
                {expandedId === ev.id ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {expandedId === ev.id && (
                <div className="mt-2 space-y-2">
                  {(ev.conversation_id || ev.message_id) && (
                    <p className="text-xs text-muted-foreground">
                      {ev.conversation_id && (
                        <span className="block truncate">
                          conversa: <code>{ev.conversation_id}</code>
                        </span>
                      )}
                      {ev.message_id && (
                        <span className="block truncate">
                          mensagem: <code>{ev.message_id}</code>
                        </span>
                      )}
                    </p>
                  )}
                  <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(
                      { level: ev.level, stage: ev.stage, ...ev.detail },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ButtonTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
