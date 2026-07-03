"use client";

import { cn } from "@/lib/utils";
import {
  EXIT_FLOW_RULES,
  getRelatedParallelStages,
  getStageDefinitionForPanel,
  getStageEntryTriggers,
  getStageExitTransitions,
  getStageInboundTransitions,
  PARALLEL_ACTIVATION_RULES,
} from "@/lib/virtual-assistant/agent-pipeline/flow-model";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";
import { MAIN_STAGE_CODES } from "@/lib/virtual-assistant/agent-pipeline/swimlane-layout";

type Props = {
  stageCode: AgentPipelineStage | "escalonamento" | null;
  parallelActive?: AgentPipelineStage[];
  onClose?: () => void;
  onSelectStage?: (code: AgentPipelineStage | "escalonamento") => void;
  className?: string;
};

function formatTriggerLabel(type: string, label: string): string {
  const prefixes: Record<string, string> = {
    intent: "intent",
    journey_step: "journey",
    ai_state: "state",
    tool_result: "tool",
    human_action: "ação",
    timeout: "timeout",
  };
  const p = prefixes[type];
  if (p && !label.toLowerCase().startsWith(p)) return `${p}: ${label}`;
  return label;
}

export function StageDetailPanel({
  stageCode,
  parallelActive = [],
  onClose,
  onSelectStage,
  className,
}: Props) {
  if (!stageCode) {
    return (
      <div className={cn("rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground", className)}>
        <p className="font-medium text-foreground mb-1">Detalhes da etapa</p>
        <p className="text-xs">
          Clique numa etapa CRM, use o stepper acima ou o modo passo a passo para ver triggers, tools e saídas.
        </p>
      </div>
    );
  }

  const def = getStageDefinitionForPanel(stageCode);
  const entryTriggers = getStageEntryTriggers(stageCode);
  const inbound = getStageInboundTransitions(stageCode);
  const exits = getStageExitTransitions(stageCode);
  const parallelRule = PARALLEL_ACTIVATION_RULES.find((r) => r.stage === stageCode);
  const relatedParallels =
    stageCode !== "escalonamento" ? getRelatedParallelStages(stageCode) : [];
  const isMainStage = MAIN_STAGE_CODES.includes(stageCode as (typeof MAIN_STAGE_CODES)[number]);

  return (
    <div className={cn("rounded-lg border bg-card p-3 text-xs overflow-y-auto max-h-full", className)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-sm">{def.label}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{stageCode}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-[10px]">
            Fechar
          </button>
        )}
      </div>

      <section className="mb-3">
        <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Pré-condições</p>
        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
          {def.preconditions.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mb-3">
        <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Como entra nesta etapa
        </p>
        <p className="text-[10px] text-muted-foreground mb-1">Switch Resolver (prioridade 1→9):</p>
        <ul className="space-y-1 mb-2">
          {entryTriggers.slice(0, 6).map((t) => (
            <li key={t.id} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800">
              <span className="font-mono text-[9px] opacity-70">P{t.priority}</span> —{" "}
              {formatTriggerLabel(t.trigger.type, t.label)}
            </li>
          ))}
          {entryTriggers.length === 0 && <li className="text-muted-foreground">Via transição CRM</li>}
        </ul>
        {inbound.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground mb-1">Transições CRM de outras etapas:</p>
            <ul className="space-y-0.5">
              {inbound.map((t) => (
                <li key={t.id} className="text-[10px] rounded bg-slate-50 px-1.5 py-0.5">
                  ← {String(t.from)}: {formatTriggerLabel(t.trigger.type, t.label ?? t.trigger.label)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {relatedParallels.length > 0 && (
        <section className="mb-3">
          <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Paralelas ativam quando…
          </p>
          <ul className="space-y-1">
            {relatedParallels.map((r) => (
              <li key={r.stage} className="rounded bg-slate-100 px-1.5 py-1 text-[10px]">
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => onSelectStage?.(r.stage)}
                >
                  {r.label}
                </button>
                <span className="text-muted-foreground"> — {r.activatesWhen}</span>
                {parallelActive.includes(r.stage) && (
                  <span className="ml-1 inline-block rounded bg-primary/15 px-1 py-0.5 text-[8px] text-primary font-medium">
                    ativa
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parallelRule && (
        <section className="mb-3">
          <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Esta etapa é paralela (overlay)
          </p>
          <p className="text-[10px] rounded bg-slate-100 px-1.5 py-1">{parallelRule.activatesWhen}</p>
          {parallelActive.includes(parallelRule.stage) && (
            <span className="mt-1 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary font-medium">
              Ativa agora
            </span>
          )}
        </section>
      )}

      <section className="mb-3">
        <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Tools permitidas</p>
        {def.readTools.length > 0 && (
          <p className="text-[10px] mb-0.5">
            <span className="text-muted-foreground">Leitura:</span> {def.readTools.join(", ")}
          </p>
        )}
        {def.mutatingTools.length > 0 && (
          <p className="text-[10px] text-amber-800">
            <span className="text-muted-foreground">Mutáveis:</span> {def.mutatingTools.join(", ")}
          </p>
        )}
        {def.requiredOrder && def.requiredOrder.length > 1 && (
          <p className="text-[10px] mt-1 text-orange-700">Ordem: {def.requiredOrder.join(" → ")}</p>
        )}
      </section>

      <section className="mb-3">
        <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Saídas da etapa</p>
        <ul className="space-y-1">
          {def.exitConditions.map((e) => (
            <li key={e} className="text-[10px] text-muted-foreground">
              {e}
            </li>
          ))}
        </ul>
        {exits.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {exits.map((t) => (
              <li key={t.id} className="text-[10px] rounded bg-purple-50 px-1.5 py-0.5">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => onSelectStage?.(t.to as AgentPipelineStage | "escalonamento")}
                >
                  → {String(t.to)}
                </button>
                : {formatTriggerLabel(t.trigger.type, t.label ?? t.trigger.label)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isMainStage && (
        <section className="mb-1">
          <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Escalonamento</p>
          <p className="text-[10px] rounded bg-red-50 border border-red-100 px-1.5 py-1 text-red-800">
            {EXIT_FLOW_RULES.find((r) => r.id === "exit-escalate-stage")?.effect ?? "transfer_to_human"}
          </p>
          <button
            type="button"
            className="mt-1 text-[10px] text-red-700 hover:underline"
            onClick={() => onSelectStage?.("escalonamento")}
          >
            Ver etapa Escalonamento →
          </button>
        </section>
      )}
    </div>
  );
}
