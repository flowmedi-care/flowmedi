/**
 * Contrato de deep link do Hoje — estado navegável, não só UI.
 * /dashboard/hoje?area=consultas&stage=confirmar&case=uuid
 */

import type { OpsBoardStage, OpsPanoramaSlice } from "./types";

export type HojeArea = OpsPanoramaSlice;

export type HojeActionContext = {
  area?: HojeArea | null;
  stage?: OpsBoardStage | string | null;
  caseId?: string | null;
  focus?: "pendencias" | null;
};

const AREAS: HojeArea[] = ["contatos", "agendamentos", "consultas", "pacientes"];

export function isHojeArea(v: string | null | undefined): v is HojeArea {
  return !!v && (AREAS as string[]).includes(v);
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
  return {
    area: isHojeArea(sp.area) ? sp.area : null,
    stage: sp.stage ?? null,
    caseId: sp.case ?? sp.caseId ?? null,
    focus: sp.focus === "pendencias" ? "pendencias" : null,
  };
}

/** Mapeia ação de next_decision → contexto Hoje (lente + coluna) */
export function actionToHojeContext(
  action: string,
  caseId?: string | null
): HojeActionContext {
  const map: Record<string, { area: HojeArea; stage: OpsBoardStage }> = {
    confirm_slot: { area: "consultas", stage: "confirmar" },
    confirm_appointment: { area: "consultas", stage: "confirmar" },
    reschedule: { area: "agendamentos", stage: "reagendar" },
    advance_commercial: { area: "agendamentos", stage: "agendar" },
    qualify_lead: { area: "contatos", stage: "qualificacao" },
    call_again: { area: "contatos", stage: "qualificacao" },
    post_consult: { area: "pacientes", stage: "pos_consulta" },
    send_reminder: { area: "consultas", stage: "confirmar" },
    handoff: { area: "contatos", stage: "qualificacao" },
  };
  const hit = map[action] ?? { area: "consultas" as HojeArea, stage: "confirmar" as OpsBoardStage };
  return { ...hit, caseId: caseId ?? null };
}

export const AREA_COLUMNS: Record<HojeArea, OpsBoardStage[]> = {
  contatos: ["contato_novo", "qualificacao", "qualificado", "perdido"],
  agendamentos: ["agendar", "reagendar"],
  consultas: ["confirmar", "hoje", "em_atendimento", "realizada", "falta"],
  pacientes: ["pos_consulta", "tratamento", "retorno", "reativacao"],
};

export const AREA_HINTS: Record<HojeArea, string> = {
  contatos: "Pessoas sem jornada definida",
  agendamentos: "Marcar e remarcar",
  consultas: "Confirmar e acompanhar o dia",
  pacientes: "Pós, tratamentos, retornos e reativações",
};
