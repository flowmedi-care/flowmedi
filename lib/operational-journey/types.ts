/**
 * OperationalProjection — visão (não entidade).
 * Junta Cases + next_decision + appointments + leads para o Dashboard Hoje.
 */

import type { DecisionDecider, NextDecision } from "@/lib/case-management/next-decision";

/** Fatias de panorama (linguagem da secretária) */
export type OpsPanoramaSlice =
  | "contatos"
  | "agendamentos"
  | "consultas"
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
  // Contatos (leads / início)
  | "contato_novo"
  | "qualificacao"
  | "qualificado"
  | "perdido"
  // Agendamentos
  | "agendar"
  | "reagendar"
  // Consultas
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
  journeyType: JourneyTypeCode;
  phaseCode: string | null;
  boardStage: OpsBoardStage | null;
  panoramaSlice: OpsPanoramaSlice | null;
  nextDecision: NextDecision | null;
  decider: DecisionDecider;
  ownerType: string;
  appointmentId: string | null;
  appointmentStatus: string | null;
  scheduledAt: string | null;
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
  contatos: { novo: number; qualificacao: number; qualificado: number; perdido: number };
  agendamentos: { agendar: number; reagendar: number };
  consultas: {
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
  /** Pendências pessoa-first */
  pendencias: CaseProjectionItem[];
};

export const BOARD_STAGE_LABELS: Record<OpsBoardStage, string> = {
  contato_novo: "Novo",
  qualificacao: "Qualificação",
  qualificado: "Qualificado",
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
  contatos: "Contatos",
  agendamentos: "Agendamentos",
  consultas: "Consultas",
  pacientes: "Pacientes",
};
