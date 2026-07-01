"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  JOURNEY_FLOW_NODES,
  type FlowNodeDef,
} from "@/lib/contact-journey/flow-graph";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey/steps";
import type { JourneyStepCode, JourneyPhase } from "@/lib/contact-journey/types";
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS } from "@/lib/leads/lifecycle";
import {
  FLOW_NODE_DESCRIPTIONS,
  CRM_JOURNEY_PHASE_INTROS,
} from "@/lib/instrucoes/crm-journey-lesson";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, MousePointerClick } from "lucide-react";

const ALL_PHASE_COLS: { phase: JourneyPhase; col: number }[] = [
  { phase: "captacao", col: 0 },
  { phase: "comercial", col: 1 },
  { phase: "pre_consulta", col: 2 },
  { phase: "consulta", col: 3 },
  { phase: "financeiro", col: 4 },
  { phase: "pos_consulta", col: 5 },
  { phase: "reengajamento", col: 6 },
];

const PHASE_INTRO_MAP = new Map(
  CRM_JOURNEY_PHASE_INTROS.map((p) => [p.phase, p])
);

function ExplorerNode({
  node,
  selected,
  onSelect,
}: {
  node: FlowNodeDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-all sm:text-sm leading-tight",
        selected
          ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/30 shadow-md scale-[1.02]"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 text-foreground"
      )}
      title={node.label}
    >
      {node.label}
    </button>
  );
}

export function InstructionFlowExplorer() {
  const [selectedCode, setSelectedCode] = useState<JourneyStepCode | null>(null);
  const maxRow = Math.max(...JOURNEY_FLOW_NODES.map((n) => n.row)) + 1;

  const selectedNode = selectedCode
    ? JOURNEY_FLOW_NODES.find((n) => n.code === selectedCode)
    : null;
  const selectedInfo = selectedCode ? FLOW_NODE_DESCRIPTIONS[selectedCode] : null;

  return (
    <div className="space-y-8 -mx-2 md:-mx-4">
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 md:p-6">
        <p className="text-sm font-medium text-foreground mb-4 text-center">
          Resumo do funil — as 6 etapas que a gestão acompanha
        </p>
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
          {LIFECYCLE_STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              <span className="rounded-full border border-primary/40 bg-background px-4 py-1.5 text-sm font-medium shadow-sm">
                {LIFECYCLE_STAGE_LABELS[stage]}
              </span>
              {i < LIFECYCLE_STAGES.length - 1 && (
                <span className="text-muted-foreground text-lg hidden sm:inline">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {CRM_JOURNEY_PHASE_INTROS.map((phase) => (
          <div
            key={phase.phase}
            className="rounded-lg border border-border/50 bg-card/60 p-3 text-center xl:text-left"
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              {JOURNEY_PHASE_LABELS[phase.phase]}
            </p>
            <p className="text-sm font-medium mt-1">{phase.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{phase.description}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 min-w-0 rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/20 p-4 md:p-6 overflow-x-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
            <MousePointerClick className="h-4 w-4 shrink-0" />
            <span>Clique em um passo abaixo para ver o que significa e o que fazer.</span>
          </div>
          <div className="flex min-w-[1100px] gap-3 pb-2">
            {ALL_PHASE_COLS.map(({ phase, col }) => {
              const intro = PHASE_INTRO_MAP.get(phase);
              return (
                <div key={phase} className="flex-1 min-w-[140px]">
                  <div className="mb-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {JOURNEY_PHASE_LABELS[phase]}
                    </p>
                    {intro && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                        {intro.title}
                      </p>
                    )}
                  </div>
                  <div
                    className="grid gap-2.5"
                    style={{ gridTemplateRows: `repeat(${maxRow}, minmax(44px, auto))` }}
                  >
                    {Array.from({ length: maxRow }).map((_, row) => {
                      const node = JOURNEY_FLOW_NODES.find((n) => n.col === col && n.row === row);
                      if (!node) return <div key={`e-${col}-${row}`} />;
                      return (
                        <div key={node.code}>
                          <ExplorerNode
                            node={node}
                            selected={selectedCode === node.code}
                            onSelect={() =>
                              setSelectedCode((c) => (c === node.code ? null : node.code))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Card className="xl:w-80 shrink-0 h-fit xl:sticky xl:top-6 border-primary/20 shadow-lg">
          <CardContent className="p-5 space-y-4">
            {selectedNode && selectedInfo ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    {JOURNEY_PHASE_LABELS[selectedNode.phase]}
                  </p>
                  <p className="text-lg font-semibold leading-snug">{selectedNode.label}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedInfo.description}
                </p>
                {selectedInfo.whatToDo && (
                  <div className="rounded-lg bg-primary/5 border border-primary/15 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">O que fazer</p>
                    <p className="text-sm text-foreground/90">{selectedInfo.whatToDo}</p>
                  </div>
                )}
                {selectedInfo.appHref && (
                  <Button variant="default" size="sm" className="w-full" asChild>
                    <Link href={selectedInfo.appHref}>
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      {selectedInfo.appLabel ?? "Abrir no app"}
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <div className="text-center py-6 space-y-2">
                <MousePointerClick className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Escolha um passo no mapa ao lado para ver a explicação em linguagem simples.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
