"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OpsBoardStage } from "@/lib/operational-journey";
import { changeAttendanceStatus } from "@/app/dashboard/crm/jornada/case-actions";

const ATTENDANCE_STAGE_TO_STATUS: Partial<
  Record<OpsBoardStage, "agendada" | "confirmada" | "realizada" | "falta" | "cancelada">
> = {
  confirmar: "agendada",
  hoje: "confirmada",
  realizada: "realizada",
  falta: "falta",
};

/**
 * Move operacional no Hoje (Cases / appointments).
 * Atendimentos: persiste status da consulta.
 * Agenda / Pacientes / em_atendimento: atualiza pending_decision do Case (sem misturar lifecycle comercial).
 */
export async function moveHojeOperationalCard(input: {
  caseId: string;
  area: "agenda" | "atendimentos" | "pacientes";
  targetStage: OpsBoardStage;
  appointmentId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { ok: false, error: "Sem clínica." };

  const { caseId, area, targetStage, appointmentId } = input;

  if (area === "atendimentos") {
    const status = ATTENDANCE_STAGE_TO_STATUS[targetStage];
    if (status && appointmentId) {
      const res = await changeAttendanceStatus(appointmentId, status);
      if (!res.ok) return { ok: false, error: res.error };
      revalidatePath("/dashboard/hoje");
      return { ok: true };
    }
    if (targetStage === "em_atendimento" && appointmentId) {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "em_atendimento" })
        .eq("id", appointmentId)
        .eq("clinic_id", profile.clinic_id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard/hoje");
      return { ok: true };
    }
  }

  const actionByStage: Partial<Record<OpsBoardStage, string>> = {
    agendar: "advance_commercial",
    reagendar: "reschedule",
    confirmar: "confirm_appointment",
    hoje: "confirm_appointment",
    em_atendimento: "handoff",
    realizada: "post_consult",
    falta: "call_again",
    pos_consulta: "post_consult",
    tratamento: "post_consult",
    retorno: "post_consult",
    reativacao: "call_again",
  };

  const action = actionByStage[targetStage] ?? "handoff";
  const labelMap: Partial<Record<OpsBoardStage, string>> = {
    agendar: "Agendar consulta",
    reagendar: "Reagendar",
    confirmar: "Confirmar consulta",
    hoje: "Consulta hoje",
    em_atendimento: "Em atendimento",
    realizada: "Consulta realizada",
    falta: "Registrar falta",
    pos_consulta: "Pós-consulta",
    tratamento: "Tratamento",
    retorno: "Retorno",
    reativacao: "Reativação",
  };

  const { error } = await supabase
    .from("journey_cases")
    .update({
      pending_decision: {
        type: action,
        waiting_for: "secretaria",
        label: labelMap[targetStage] ?? targetStage,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/hoje");
  return { ok: true };
}
