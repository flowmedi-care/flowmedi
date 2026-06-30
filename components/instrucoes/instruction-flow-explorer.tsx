"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  JOURNEY_FLOW_NODES,
  JOURNEY_FLOW_EDGES,
  type FlowNodeDef,
} from "@/lib/contact-journey/flow-graph";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey/steps";
import type { JourneyStepCode, JourneyPhase } from "@/lib/contact-journey/types";
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS } from "@/lib/leads/lifecycle";
import { FLOW_NODE_DESCRIPTIONS } from "@/lib/instrucoes/crm-journey-lesson";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const ALL_PHASE_COLS: { phase: JourneyPhase; col: number }[] = [
  { phase: "captacao", col: 0 },
  { phase: "comercial", col: 1 },
  { phase: "pre_consulta", col: 2 },
  { phase: "consulta", col: 3 },
  { phase: "financeiro", col: 4 },
  { phase: "pos_consulta", col: 5 },
  { phase: "reengajamento", col: 6 },
];

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
        "w-full rounded-lg border px-2 py-2 text-center text-[11px] font-medium transition-all sm:text-xs",
        selected
          ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/30 shadow-sm"
          : "border-border bg-card/80 backdrop-blur-sm hover:border-primary/40 hover:bg-muted/40 text-foreground"
      )}
      title={node.label}
    >
      {node.shortLabel}
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
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 overflow-x-auto">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
          Funil CRM (visão resumida)
        </p>
        <div className="flex flex-wrap justify-center gap-2 min-w-[640px]">
          {LIFECYCLE_STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              <span className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium">
                {LIFECYCLE_STAGE_LABELS[stage]}
              </span>
              {i < LIFECYCLE_STAGES.length - 1 && (
                <span className="text-muted-foreground text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/10 to-background p-4 overflow-x-auto">
          <p className="text-xs text-muted-foreground mb-4">
            Clique em um passo para ver detalhes. Linhas tracejadas no rodapé indicam ramificações
            alternativas.
          </p>
          <div className="flex min-w-[980px] gap-2">
            {ALL_PHASE_COLS.map(({ phase, col }) => (
              <div key={phase} className="flex-1 min-w-[120px]">
                <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {JOURNEY_PHASE_LABELS[phase]}
                </p>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateRows: `repeat(${maxRow}, minmax(40px, auto))` }}
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
            ))}
          </div>
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardContent className="p-4 space-y-3">
            {selectedNode ? (
              <>
                <p className="text-sm font-semibold">{selectedNode.label}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedInfo?.description ??
                    `Passo operacional na fase ${JOURNEY_PHASE_LABELS[selectedNode.phase]}.`}
                </p>
                {selectedInfo?.appHref && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={selectedInfo.appHref}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      {selectedInfo.appLabel ?? "Abrir no app"}
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um passo no mapa para ver o que significa e onde gerenciar no app.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <details className="rounded-lg border border-border/60 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-foreground">
          Ver todas as conexões do fluxo
        </summary>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2 text-muted-foreground">
          {JOURNEY_FLOW_EDGES.map((e) => (
            <li key={`${e.from}-${e.to}`} className={cn(e.branch && "opacity-70")}>
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
