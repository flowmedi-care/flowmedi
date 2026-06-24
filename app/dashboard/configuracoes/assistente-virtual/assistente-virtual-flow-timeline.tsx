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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AiEventRow } from "@/lib/virtual-assistant/diagnostics";
import type { FlowStepStatus, FlowTraceStatus, MessageFlowTrace } from "@/lib/virtual-assistant/diagnostics-flow";

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

function FlowTraceCard({
  trace,
  rawEvents,
}: {
  trace: MessageFlowTrace;
  rawEvents: AiEventRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = channelIcon(trace.channel);
  const status = TRACE_STATUS[trace.status];

  const traceEvents = rawEvents.filter((e) => trace.eventIds.includes(e.id));

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
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
              {trace.channel === "audio" && (
                <Badge variant="outline" className="border-violet-200 text-violet-700">
                  Áudio
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {trace.messagePreview}
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
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Detalhes
        </button>
      </header>

      <div className="px-4 py-4">
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
                  {step.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {expanded && traceEvents.length > 0 && (
        <footer className="border-t bg-muted/20 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Eventos brutos</p>
          <ul className="space-y-1">
            {traceEvents.map((ev) => (
              <li key={ev.id} className="rounded-md bg-background px-2 py-1.5 text-xs">
                <span className="font-mono text-muted-foreground">{ev.stage}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span>{formatTime(ev.created_at)}</span>
              </li>
            ))}
          </ul>
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
};

function levelDot(level: string): string {
  if (level === "error") return "bg-red-500";
  if (level === "warn") return "bg-amber-500";
  return "bg-green-500";
}

export function AssistenteVirtualFlowTimeline({ flows, events, showRaw, onToggleRaw }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <div className="space-y-4">
            {flows.map((trace) => (
              <FlowTraceCard key={trace.id} trace={trace} rawEvents={events} />
            ))}
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="rounded-lg border bg-card p-3 text-sm">
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot(ev.level)}`} />
                <span className="flex-1">
                  <span className="font-medium">{STAGE_LABELS[ev.stage] ?? ev.stage}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                  </span>
                </span>
              </button>
              {expandedId === ev.id && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(ev.detail, null, 2)}
                </pre>
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
