import type { PipelineConversions, PipelineDrop, PipelineStageKey } from "./types";
import { STAGE_LABELS } from "./types";

export function dropPct(from: number, to: number): number {
  if (from <= 0) return 0;
  return ((from - to) / from) * 100;
}

export function buildPipelineHealth(
  stages: { key: PipelineStageKey; amount: number }[],
  causes: Partial<Record<string, string>>
): PipelineDrop[] {
  const drops: PipelineDrop[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    const key = `${from.key}->${to.key}`;
    drops.push({
      from: from.key,
      to: to.key,
      fromAmount: from.amount,
      toAmount: to.amount,
      dropPct: dropPct(from.amount, to.amount),
      cause: causes[key] ?? "—",
    });
  }
  return drops;
}

export function buildConversions(input: {
  agendado: number;
  previsto: number;
  faturado: number;
  recebido: number;
}): PipelineConversions {
  const { agendado, previsto, faturado, recebido } = input;
  return {
    comparecimentoPct: agendado > 0 ? (previsto / agendado) * 100 : 100,
    faturamentoPct: previsto > 0 ? (faturado / previsto) * 100 : agendado > 0 ? (faturado / agendado) * 100 : 100,
    recebimentoPct: faturado > 0 ? (recebido / faturado) * 100 : 100,
  };
}

export function stageAmount(key: PipelineStageKey, amount: number) {
  return { key, label: STAGE_LABELS[key], amount };
}
