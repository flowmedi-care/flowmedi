"use client";

import type { PipelineTrace } from "@/lib/operational-agents/pipeline-trace";
import { AgentUnifiedPipelineCanvas } from "./agent-unified-pipeline-canvas";
import { cn } from "@/lib/utils";

export type AgentPipelineGraphProps = {
  trace?: PipelineTrace | null;
  showExpandButton?: boolean;
  className?: string;
};

/** Mapa unificado do pipeline — substitui o grafo SVG anterior. */
export function AgentPipelineGraph({
  trace,
  showExpandButton = true,
  className,
}: AgentPipelineGraphProps) {
  return (
    <AgentUnifiedPipelineCanvas
      trace={trace}
      variant="compact"
      showExpandButton={showExpandButton}
      showLegend={false}
      className={cn("min-h-[180px]", className)}
    />
  );
}

export default AgentPipelineGraph;
