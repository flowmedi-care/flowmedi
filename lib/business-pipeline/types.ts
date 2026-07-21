/** Tipos do Pipeline Financeiro (domínio). */

export type FinanceLens =
  | "operacao"
  | "previsao"
  | "competencia"
  | "caixa"
  | "performance";

export type CobrarAction = "receber_antes" | "emitir_cobranca";

export type CobrarPolicyBadge = "antecipado" | "no_dia" | "pos_consulta";

export type ProbabilitySource = "service" | "doctor" | "clinic";

export type ConfidenceLevel = "muito_confiavel" | "confiavel" | "pouco_historico";

export type PipelineStageKey = "agendado" | "previsto" | "faturado" | "recebido";

export type PipelineStageAmount = {
  key: PipelineStageKey;
  label: string;
  amount: number;
};

export type PipelineDrop = {
  from: PipelineStageKey;
  to: PipelineStageKey;
  fromAmount: number;
  toAmount: number;
  dropPct: number;
  cause: string;
};

export type PipelineConversions = {
  comparecimentoPct: number;
  faturamentoPct: number;
  recebimentoPct: number;
};

export type ForecastConfidence = {
  level: ConfidenceLevel;
  label: string;
  sampleSize: number;
  rationale: string;
};

export type ForecastAccuracy = {
  pct: number;
  sampleSize: number;
} | null;

export type ForecastReasoning = {
  probabilitySource: ProbabilitySource;
  sampleSize: number;
  fallback: boolean;
};

export type ForecastResult = {
  lens: "competencia" | "caixa";
  agendado: number;
  previsto: number;
  faturado: number;
  recebido: number;
  saldo?: number;
  confidence: ForecastConfidence;
  accuracy: ForecastAccuracy;
  assumptions: string[];
  reasoning: ForecastReasoning;
  conversions: PipelineConversions;
  pipelineHealth: PipelineDrop[];
  attendanceRatePct: number;
};

export type PerformanceMetrics = {
  receitaMomPct: number;
  receitaAtual: number;
  receitaAnterior: number;
  noShowPct: number;
  noShowDeltaPct: number;
  tempoMedioReceberDias: number | null;
  sampleSize: number;
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  muito_confiavel: "Muito confiável",
  confiavel: "Confiável",
  pouco_historico: "Pouco histórico",
};

export const STAGE_LABELS: Record<PipelineStageKey, string> = {
  agendado: "Agendado",
  previsto: "Previsto",
  faturado: "Faturado",
  recebido: "Recebido",
};

export const COBRAR_ACTION_LABELS: Record<CobrarAction, string> = {
  receber_antes: "Receber antes da consulta",
  emitir_cobranca: "Emitir cobrança",
};

export const COBRAR_BADGE_LABELS: Record<CobrarPolicyBadge, string> = {
  antecipado: "Antecipado",
  no_dia: "No dia",
  pos_consulta: "Pós-consulta",
};
