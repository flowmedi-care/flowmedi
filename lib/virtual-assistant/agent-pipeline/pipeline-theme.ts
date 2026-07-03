import type { UnifiedEdgeKind } from "./unified-flow-graph";

/** Paleta simplificada — 4 significados visuais no canvas da jornada. */
export const PIPELINE_THEME = {
  stage: {
    neutral: "border-border bg-card",
    current: "border-primary ring-2 ring-primary/40 bg-primary/5",
    visited: "border-green-400/70 bg-green-50/30",
    transversal: "border-red-400/80 border-dashed bg-red-50/50",
    parallel: "border-dashed border-muted-foreground/40 bg-card",
  },
  edge: {
    neutral: "#94a3b8",
    active: "hsl(var(--primary))",
    visited: "#22c55e",
    transversal: "#ef4444",
  },
  handle: "!w-2 !h-2 !bg-muted-foreground/35 !border-muted-foreground/50",
} as const;

export const JOURNEY_LEGEND_ITEMS = [
  { key: "neutral", label: "Etapa normal", swatch: "border-2 border-border bg-card" },
  { key: "current", label: "Etapa atual", swatch: "border-2 border-primary bg-primary/10" },
  { key: "visited", label: "Visitada", swatch: "border-2 border-green-400/70 bg-green-50/40" },
  { key: "transversal", label: "Global / transversal", swatch: "border-2 border-dashed border-red-400/80 bg-red-50/40" },
] as const;

/** Stroke unificado para edges CRM; demais kinds mantêm distinção mínima na aba Execução. */
export function getEdgeStroke(
  kind: UnifiedEdgeKind,
  state: "neutral" | "active" | "visited"
): string {
  if (state === "active") return PIPELINE_THEME.edge.active;
  if (state === "visited") return PIPELINE_THEME.edge.visited;
  if (kind === "transversal") return PIPELINE_THEME.edge.transversal;
  return PIPELINE_THEME.edge.neutral;
}

export function getEdgeStrokeWidth(kind: UnifiedEdgeKind, highlighted: boolean): number {
  if (highlighted) return 2.5;
  if (kind === "transversal") return 2;
  return 1.75;
}
