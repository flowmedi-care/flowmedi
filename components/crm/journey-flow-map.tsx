"use client";

import { cn } from "@/lib/utils";
import {
  JOURNEY_FLOW_NODES,
  JOURNEY_FLOW_EDGES,
  isOnActiveBranch,
  FLOW_PHASE_COLS,
  type FlowNodeDef,
} from "@/lib/contact-journey/flow-graph";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey/steps";
import type { JourneyPhase, JourneyStepCode } from "@/lib/contact-journey/types";

type JourneyFlowMapProps = {
  currentStep: JourneyStepCode;
  completedSteps: JourneyStepCode[];
};

const PHASE_COLS = FLOW_PHASE_COLS;

function FlowNode({
  node,
  state,
}: {
  node: FlowNodeDef;
  state: "current" | "completed" | "upcoming" | "alternate";
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border px-3 py-2 text-center text-xs font-medium transition-all sm:text-sm",
        state === "current" &&
          "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30 animate-pulse",
        state === "completed" &&
          "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300",
        state === "upcoming" && "border-border bg-muted/20 text-muted-foreground",
        state === "alternate" && "border-dashed border-border/60 bg-muted/10 text-muted-foreground/60"
      )}
      title={node.label}
    >
      {node.shortLabel}
      {state === "current" && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
          Agora
        </span>
      )}
    </div>
  );
}

export function JourneyFlowMap({ currentStep, completedSteps }: JourneyFlowMapProps) {
  const maxRow = Math.max(...JOURNEY_FLOW_NODES.map((n) => n.row)) + 1;

  return (
    <div className="space-y-4 overflow-x-auto pb-2">
      <div className="flex min-w-[1120px] gap-2">
        {PHASE_COLS.map(({ phase, col }) => (
          <div key={phase} className="flex-1 min-w-[160px]">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {JOURNEY_PHASE_LABELS[phase]}
            </p>
            <div
              className="grid gap-3"
              style={{ gridTemplateRows: `repeat(${maxRow}, minmax(44px, auto))` }}
            >
              {Array.from({ length: maxRow }).map((_, row) => {
                const node = JOURNEY_FLOW_NODES.find((n) => n.col === col && n.row === row);
                if (!node) {
                  return <div key={`empty-${col}-${row}`} />;
                }
                const state = isOnActiveBranch(node.code, currentStep, completedSteps);
                return (
                  <div key={node.code} className="flex flex-col items-center">
                    <FlowNode node={node} state={state} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Caminho em destaque mostra onde o contato está. Ramificações tracejadas são desfechos
        alternativos da consulta.
      </p>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground/80">
          Ver conexões do fluxo
        </summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {JOURNEY_FLOW_EDGES.map((e) => (
            <li key={`${e.from}-${e.to}`} className={cn(e.branch && "text-muted-foreground/70")}>
              {JOURNEY_FLOW_NODES.find((n) => n.code === e.from)?.shortLabel} →{" "}
              {JOURNEY_FLOW_NODES.find((n) => n.code === e.to)?.shortLabel}
              {e.branch ? " (ramificação)" : ""}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
