"use client";

import { useState } from "react";
import { ChevronDown, Copy, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyToClipboard, formatJson } from "./utils";

type DebugInfo = {
  executorMode?: string;
  argsSent?: Record<string, unknown>;
  aiStateBefore?: Record<string, unknown>;
  aiStateAfter?: Record<string, unknown>;
  implicitPatch?: Record<string, unknown>;
  toolLogId?: string;
  warnings?: string[];
  httpStatus?: number;
};

type Props = {
  toolName: string;
  durationMs: number;
  handoff: boolean;
  result: unknown;
  statePatch: Record<string, unknown> | null;
  debug?: DebugInfo;
  conversationId: string;
};

function PipelineSection({
  id,
  title,
  badge,
  defaultOpen,
  children,
  onCopy,
}: {
  id: string;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  onCopy?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          <span className="text-sm font-semibold">{title}</span>
          {badge}
        </div>
        {onCopy && open && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
          >
            <Copy className="mr-1 h-3 w-3" />
            Copiar
          </Button>
        )}
      </button>
      {open && <div className="border-t px-3 py-3">{children}</div>}
    </div>
  );
}

function statusBadge(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const status = (result as { status?: string }).status;
  if (!status) return null;
  const variant =
    status === "success"
      ? "default"
      : status === "needs_input"
        ? "secondary"
        : status === "error"
          ? "destructive"
          : "warning";
  return <Badge variant={variant as "default"}>{status}</Badge>;
}

export function ExecutionPipeline({
  toolName,
  durationMs,
  handoff,
  result,
  statePatch,
  debug,
  conversationId,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Pipeline de execução</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {durationMs}ms
          {handoff && <Badge variant="warning">Handoff humano</Badge>}
          {debug?.executorMode && (
            <Badge variant="outline">
              {debug.executorMode === "production" ? "Produção" : "Completo (VA)"}
            </Badge>
          )}
        </div>
      </div>

      <PipelineSection
        id="input"
        title="INPUT"
        defaultOpen
        onCopy={() => copyToClipboard(formatJson({ args: debug?.argsSent, aiState: debug?.aiStateBefore }))}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">args enviados</p>
          <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
            {formatJson(debug?.argsSent ?? {})}
          </pre>
          <p className="text-xs font-medium text-muted-foreground">aiState antes</p>
          <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
            {formatJson(debug?.aiStateBefore ?? {})}
          </pre>
        </div>
      </PipelineSection>

      <PipelineSection id="run" title="RUN TOOL" defaultOpen badge={<code className="text-xs">{toolName}</code>}>
        <p className="text-xs text-muted-foreground">
          Conversa: <code>{conversationId}</code>
        </p>
        <p className="mt-1 text-xs">Duração: {durationMs}ms</p>
      </PipelineSection>

      <PipelineSection
        id="output"
        title="OUTPUT"
        defaultOpen={toolName !== "find_available_slots"}
        badge={statusBadge(result)}
        onCopy={() => copyToClipboard(formatJson(result))}
      >
        {toolName === "find_available_slots" && (
          <p className="mb-2 text-xs text-muted-foreground">
            Use o painel de agendamento acima para escolher dia e horário. JSON bruto abaixo.
          </p>
        )}
        <pre className="max-h-80 overflow-auto rounded bg-muted/50 p-3 text-xs">{formatJson(result)}</pre>
      </PipelineSection>

      {(statePatch && Object.keys(statePatch).length > 0) && (
        <PipelineSection
          id="patch"
          title="STATE PATCH"
          defaultOpen
          onCopy={() => copyToClipboard(formatJson(statePatch))}
        >
          <pre className="max-h-40 overflow-auto rounded bg-amber-500/10 p-3 text-xs">
            {formatJson(statePatch)}
          </pre>
          {debug?.implicitPatch && Object.keys(debug.implicitPatch).length > 0 && (
            <>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Patch implícito (patchAiState)</p>
              <pre className="max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {formatJson(debug.implicitPatch)}
              </pre>
            </>
          )}
          {debug?.aiStateAfter && (
            <>
              <p className="mt-2 text-xs font-medium text-muted-foreground">aiState depois</p>
              <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
                {formatJson(debug.aiStateAfter)}
              </pre>
            </>
          )}
        </PipelineSection>
      )}

      <PipelineSection
        id="logs"
        title="LOGS"
        onCopy={() =>
          copyToClipboard(
            formatJson({
              toolLogId: debug?.toolLogId,
              warnings: debug?.warnings,
              httpStatus: debug?.httpStatus,
            })
          )
        }
      >
        <div className="space-y-2 text-xs">
          {debug?.toolLogId && (
            <p>
              <span className="font-medium">Tool log ID:</span>{" "}
              <code>{debug.toolLogId}</code>
            </p>
          )}
          {debug?.warnings?.length ? (
            <ul className="list-inside list-disc space-y-1 text-amber-700 dark:text-amber-400">
              {debug.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Sem warnings.</p>
          )}
          <p className="text-muted-foreground">
            SQL detalhado não disponível — consulte whatsapp_ai_tool_log no banco.
          </p>
        </div>
      </PipelineSection>
    </div>
  );
}
