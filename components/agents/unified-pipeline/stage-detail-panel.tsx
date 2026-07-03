"use client";

import { cn } from "@/lib/utils";
import {
  getStageDefinitionForPanel,
  getStageEntryTriggers,
  getStageExitTransitions,
  PARALLEL_ACTIVATION_RULES,
} from "@/lib/virtual-assistant/agent-pipeline/flow-model";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";

type Props = {
  stageCode: AgentPipelineStage | "escalonamento" | null;
  parallelActive?: AgentPipelineStage[];
  onClose?: () => void;
  className?: string;
};

export function StageDetailPanel({ stageCode, parallelActive = [], onClose, className }: Props) {
  if (!stageCode) {
    return (
      <div className={cn("rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground", className)}>
        <p className="font-medium text-foreground mb-1">Detalhes da etapa</p>
        <p className="text-xs">Clique numa etapa CRM ou use o modo passo a passo para ver triggers, tools e saídas.</p>
      </div>
    );
  }

  const def = getStageDefinitionForPanel(stageCode);
  const entryTriggers = getStageEntryTriggers(stageCode);
  const exits = getStageExitTransitions(stageCode);
  const parallelRule = PARALLEL_ACTIVATION_RULES.find((r) => r.stage === stageCode);

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
        <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Como entra nesta etapa</p>
        <ul className="space-y-1">
          {entryTriggers.slice(0, 5).map((t) => (
            <li key={t.id} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800">
              <span className="font-mono text-[9px] opacity-70">{t.trigger.type}</span> — {t.label}
            </li>
          ))}
          {entryTriggers.length === 0 && <li className="text-muted-foreground">Via transição CRM ou resolver</li>}
        </ul>
      </section>

      {parallelRule && (
        <section className="mb-3">
          <p className="font-semibold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Paralela overlay</p>
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
          <p className="text-[10px] mt-1 text-orange-700">
            Ordem: {def.requiredOrder.join(" → ")}
          </p>
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
                → {String(t.to).replace("stage_", "")}: {t.label}
                <span className="ml-1 font-mono text-[8px] opacity-60">[{t.trigger.type}]</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
