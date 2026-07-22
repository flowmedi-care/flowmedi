/**
 * Contrato de deep link do Hoje — estado navegável, não só UI.
 * /dashboard/hoje?area=atendimentos&stage=confirmar&case=uuid
 */

import type { OpsBoardStage, OpsPanoramaSlice } from "./types";

export type HojeArea = OpsPanoramaSlice;

export type HojeActionContext = {
  area?: HojeArea | null;
  stage?: OpsBoardStage | string | null;
  caseId?: string | null;
  focus?: "pendencias" | "inbox" | "atencao" | null;
};

const AREAS: HojeArea[] = ["pessoas", "agenda", "atendimentos", "pacientes"];

/** Aliases v6 → v7 (deep links antigos) */
const AREA_ALIASES: Record<string, HojeArea> = {
  contatos: "pessoas",
  agendamentos: "agenda",
  consultas: "atendimentos",
  pessoas: "pessoas",
  agenda: "agenda",
  atendimentos: "atendimentos",
  pacientes: "pacientes",
};

export function isHojeArea(v: string | null | undefined): v is HojeArea {
  return !!v && (AREAS as string[]).includes(v);
}

export function normalizeHojeArea(v: string | null | undefined): HojeArea | null {
  if (!v) return null;
  return AREA_ALIASES[v] ?? (isHojeArea(v) ? v : null);
}

export function buildHojeHref(ctx: HojeActionContext = {}): string {
  const params = new URLSearchParams();
  if (ctx.area) params.set("area", ctx.area);
  if (ctx.stage) params.set("stage", String(ctx.stage));
  if (ctx.caseId) params.set("case", ctx.caseId);
  if (ctx.focus) params.set("focus", ctx.focus);
  const q = params.toString();
  return q ? `/dashboard/hoje?${q}` : "/dashboard/hoje";
}

export function parseHojeSearchParams(sp: {
  area?: string;
  stage?: string;
  case?: string;
  caseId?: string;
  focus?: string;
}): HojeActionContext {
  const focus =
    sp.focus === "pendencias" || sp.focus === "inbox" || sp.focus === "atencao"
      ? sp.focus
      : null;
  return {
    area: normalizeHojeArea(sp.area),
    stage: sp.stage ?? null,
    caseId: sp.case ?? sp.caseId ?? null,
    focus,
  };
}

/** Mapeia ação de next_decision → contexto Hoje (lente + coluna) */
export function actionToHojeContext(
  action: string,
  caseId?: string | null
): HojeActionContext {
  const map: Record<string, { area: HojeArea; stage: OpsBoardStage }> = {
    confirm_slot: { area: "atendimentos", stage: "confirmar" },
    confirm_appointment: { area: "atendimentos", stage: "confirmar" },
    reschedule: { area: "agenda", stage: "reagendar" },
    advance_commercial: { area: "agenda", stage: "agendar" },
    qualify_lead: { area: "pessoas", stage: "qualificacao" },
    call_again: { area: "pessoas", stage: "qualificacao" },
    post_consult: { area: "pacientes", stage: "pos_consulta" },
    send_reminder: { area: "atendimentos", stage: "confirmar" },
    handoff: { area: "pessoas", stage: "qualificacao" },
  };
  const hit = map[action] ?? {
    area: "atendimentos" as HojeArea,
    stage: "confirmar" as OpsBoardStage,
  };
  return { ...hit, caseId: caseId ?? null };
}

export const AREA_COLUMNS: Record<HojeArea, OpsBoardStage[]> = {
  pessoas: ["contato_novo", "qualificacao", "qualificado", "cliente", "perdido"],
  agenda: ["agendar", "reagendar"],
  atendimentos: ["confirmar", "hoje", "em_atendimento", "realizada", "falta"],
  pacientes: ["pos_consulta", "tratamento", "retorno", "reativacao"],
};

export const AREA_HINTS: Record<HojeArea, string> = {
  pessoas: "Novo · Em conversa · Oportunidade · Cliente · Perdido",
  agenda: "Marcar e remarcar",
  atendimentos: "Confirmar e acompanhar o dia",
  pacientes: "Pós, tratamentos, retornos e reativações",
};
