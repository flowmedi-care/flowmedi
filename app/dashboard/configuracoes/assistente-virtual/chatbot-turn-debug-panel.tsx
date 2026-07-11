"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AiToolLogRow } from "@/lib/virtual-assistant/diagnostics";
import type { ChatbotTurnDebug } from "@/lib/virtual-assistant/diagnostics-flow";

const SNAPSHOT_LABELS: Record<string, string> = {
  inbound: "Entrada",
  post_extractors: "Pós-extractors",
  post_mutation: "Pós-mutação",
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-1 max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function toolStatusVariant(
  blocked: boolean,
  status: string
): "destructive" | "secondary" | "outline" | "default" {
  if (blocked) return "destructive";
  if (status === "success") return "default";
  if (status === "error") return "destructive";
  return "secondary";
}

type Props = {
  trace: ChatbotTurnDebug;
  toolLogs?: AiToolLogRow[];
  startedAt?: string;
  finishedAt?: string;
};

export function ChatbotTurnDebugPanel({ trace, toolLogs, startedAt, finishedAt }: Props) {
  const windowLogs =
    toolLogs?.filter((log) => {
      if (!startedAt) return true;
      const ts = new Date(log.created_at).getTime();
      const start = new Date(startedAt).getTime() - 2000;
      const end = finishedAt
        ? new Date(finishedAt).getTime() + 2000
        : start + 120_000;
      return ts >= start && ts <= end;
    }) ?? [];

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-sky-900">Debug do chatbot</p>
        {trace.llmRounds != null && (
          <Badge variant="outline" className="text-xs">
            {trace.llmRounds} rodada(s) LLM
          </Badge>
        )}
        {trace.hadBlockedTools && (
          <Badge variant="destructive" className="text-xs">
            Tool bloqueada
          </Badge>
        )}
      </div>

      {trace.extractorsApplied && Object.keys(trace.extractorsApplied).length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Extractors
          </p>
          <JsonBlock value={trace.extractorsApplied} />
        </section>
      )}

      {trace.snapshots && trace.snapshots.length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Timeline de snapshot
          </p>
          <ul className="mt-2 space-y-2">
            {trace.snapshots.map((snap, i) => (
              <li key={`${snap.label}-${i}`} className="rounded-md border bg-background p-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{SNAPSHOT_LABELS[snap.label] ?? snap.label}</Badge>
                  <span className="font-mono text-muted-foreground">{snap.snapshotBuiltAt}</span>
                </div>
                {snap.slice?.aiState?.booking && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    booking: status={String(snap.slice.aiState.booking.status ?? "—")}
                    {snap.slice.aiState.booking.pending_slot
                      ? ` · pending=${snap.slice.aiState.booking.pending_slot}`
                      : ""}
                    {Array.isArray(snap.slice.aiState.booking.offered_slots)
                      ? ` · slots=${snap.slice.aiState.booking.offered_slots.length}`
                      : ""}
                  </p>
                )}
                {snap.slice?.derived && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    pending: {snap.slice.derived.pendingGoals?.join(", ") || "—"} · satisfied:{" "}
                    {snap.slice.derived.satisfiedGoals?.join(", ") || "—"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {trace.mutationGate && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mutation gate (booking_created)
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={trace.mutationGate.ok ? "default" : "destructive"}>
              {trace.mutationGate.ok ? "OK" : "Bloqueado"}
            </Badge>
            {!trace.mutationGate.ok && trace.mutationGate.message && (
              <span className="text-xs text-red-700">{trace.mutationGate.message}</span>
            )}
          </div>
        </section>
      )}

      {trace.allowedTools && trace.allowedTools.length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tools permitidas
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {trace.allowedTools.map((t) => (
              <Badge key={t} variant="outline" className="font-mono text-[10px]">
                {t}
              </Badge>
            ))}
          </p>
        </section>
      )}

      {trace.tools && trace.tools.length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tools executadas (runtime)
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 pr-2">Tool</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Tempo</th>
                  <th className="py-1">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {trace.tools.map((tool, i) => (
                  <tr key={`${tool.toolName}-${i}`} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 font-mono">{tool.toolName}</td>
                    <td className="py-1.5 pr-2">
                      <Badge
                        variant={toolStatusVariant(tool.blocked, tool.status)}
                        className="text-[10px]"
                      >
                        {tool.blocked ? "blocked" : tool.status}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">{tool.durationMs}ms</td>
                    <td className="py-1.5 text-muted-foreground">
                      {tool.blockReason ?? tool.resultMessage ?? "—"}
                      {tool.resolvedArgs?.scheduled_at != null && (
                        <span className="block font-mono text-[10px]">
                          scheduled_at={String(tool.resolvedArgs.scheduled_at)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {trace.createAppointmentOutcome && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            create_appointment (resumo)
          </p>
          <JsonBlock value={trace.createAppointmentOutcome} />
        </section>
      )}

      {windowLogs.length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tool log (DB) — {windowLogs.length} registro(s)
          </p>
          <ul className="mt-2 space-y-1">
            {windowLogs.map((log) => (
              <li
                key={log.id}
                className={cn(
                  "rounded border bg-background px-2 py-1.5 text-xs",
                  !log.success && "border-red-200"
                )}
              >
                <span className="font-mono">{log.tool_name}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className={log.success ? "text-green-700" : "text-red-700"}>
                  {log.success ? "ok" : "fail"}
                </span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{log.result_summary}</span>
                {log.block_reason && (
                  <span className="mt-0.5 block text-red-600">{log.block_reason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function chatbotDebugFromEvents(
  events: Array<{ stage: string; detail?: Record<string, unknown> }>
): ChatbotTurnDebug | undefined {
  const ev = events.find((e) => e.stage === "chatbot_turn_trace");
  if (!ev?.detail) return undefined;
  return ev.detail as ChatbotTurnDebug;
}
