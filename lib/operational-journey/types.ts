/**
 * OperationalProjection — visão (não entidade).
 * Junta Cases + next_decision + appointments + leads para o Dashboard Hoje.
 */

import type { DecisionActor, NextDecision } from "@/lib/case-management/next-decision";
import type { CaseProductContext } from "@/lib/case-management/case-product";

/** Lentes de operação (v7) */
export type OpsPanoramaSlice =
  | "pessoas"
  | "agenda"
  | "atendimentos"
  | "pacientes";

export type JourneyTypeCode =
  | "primeira_consulta"
  | "retorno"
  | "tratamento"
  | "reativacao"
  | "suporte"
  | "orcamento"
  | "unknown";

/** Stage dentro do board pequeno (não mega-funil único) */
export type OpsBoardStage =
  // Pessoas (relacionamentos / início)
  | "contato_novo"
  | "qualificacao"
  | "qualificado"
  | "cliente"
  | "perdido"
  // Agenda
  | "agendar"
  | "reagendar"
  // Atendimentos
  | "confirmar"
  | "hoje"
  | "em_atendimento"
  | "realizada"
  | "falta"
  // Pacientes
  | "pos_consulta"
  | "tratamento"
  | "retorno"
  | "reativacao";

export type CaseProjectionItem = {
  caseId: string;
  displayName: string;
  patientId: string | null;
  leadId: string | null;
  /** journey code (produto) */
  journey: string;
  journeyType: JourneyTypeCode;
  /** stage code (produto) — prefer boardStage when set */
  stage: string;
  phaseCode: string | null;
  boardStage: OpsBoardStage | null;
  panoramaSlice: OpsPanoramaSlice | null;
  context: CaseProductContext;
  nextDecision: NextDecision | null;
  /** @deprecated use nextDecision.actor */
  decider: DecisionActor;
  ownerType: string;
  appointmentId: string | null;
  appointmentStatus: string | null;
  scheduledAt: string | null;
  conversationId: string | null;
  href: string;
};

export type WorkActionGroup = {
  action: string;
  label: string;
  count: number;
  urgentCount: number;
  caseIds: string[];
};

export type WorkToday = {
  urgentCount: number;
  pendingCount: number;
  consultationsTodayCount: number;
  aiCount: number;
  byAction: WorkActionGroup[];
};

export type PanoramaCounts = {
  pessoas: {
    novo: number;
    qualificacao: number;
    qualificado: number;
    cliente: number;
    perdido: number;
  };
  agenda: { agendar: number; reagendar: number };
  atendimentos: {
    confirmar: number;
    hoje: number;
    em_atendimento: number;
    realizada: number;
    falta: number;
  };
  pacientes: { pos_consulta: number; tratamento: number; retorno: number; reativacao: number };
};

export type OperationalProjection = {
  workToday: WorkToday;
  panorama: PanoramaCounts;
  items: CaseProjectionItem[];
  /** Atenção: precisa da sua decisão (actor human / urgente) */
  atencao: CaseProjectionItem[];
  /** Caixa de entrada: eventos novos / aguardando outro ator */
  caixaEntrada: CaseProjectionItem[];
  /** @deprecated use atencao — alias de todas as pendências com nextDecision */
  pendencias: CaseProjectionItem[];
};

export const BOARD_STAGE_LABELS: Record<OpsBoardStage, string> = {
  contato_novo: "Novo",
  qualificacao: "Em conversa",
  qualificado: "Oportunidade",
  cliente: "Cliente",
  perdido: "Perdido",
  agendar: "Agendar",
  reagendar: "Reagendar",
  confirmar: "Confirmar",
  hoje: "Hoje",
  em_atendimento: "Em atendimento",
  realizada: "Realizada",
  falta: "Falta",
  pos_consulta: "Pós-consulta",
  tratamento: "Tratamento",
  retorno: "Retorno",
  reativacao: "Reativação",
};

export const PANORAMA_SLICE_LABELS: Record<OpsPanoramaSlice, string> = {
  pessoas: "Pessoas",
  agenda: "Agenda",
  atendimentos: "Atendimentos",
  pacientes: "Pacientes",
};
