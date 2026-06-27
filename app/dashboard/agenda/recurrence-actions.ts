"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAppointment, getAppointmentChargePreview, checkRecurrenceSlotsConflicts } from "./actions";
import type { RecurrenceSessionSlot } from "@/lib/recurrence-schedule";
import { getClinicPlanData, countMonthAppointments } from "@/lib/plan-helpers";
import { canCreateAppointment } from "@/lib/plan-gates";
import {
  serviceModeToRecurrenceBilling,
  type ServiceRecurrenceBillingMode,
} from "@/lib/recurrence-billing";

export type RecurrenceBillingModel = "independent" | "treatment_plan" | null;

export type RecurrenceSeriesAppointment = {
  id: string;
  session_number: number | null;
  scheduled_at: string;
  status: string;
  treatment_plan_id: string | null;
};

// RECORRÊNCIA v1 — Cria N consultas da série (Modelo A, B ou só agenda).
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export async function createRecurringAppointments(input: {
  patientId: string;
  doctorId: string;
  appointmentTypeId: string | null;
  procedureIds: string[];
  serviceId: string | null;
  dimensionValueIds: string[];
  slots: RecurrenceSessionSlot[];
  roomId?: string | null;
  notes?: string | null;
  recommendations?: string | null;
  specialInstructions?: string | null;
  preparationNotes?: string | null;
  linkedFormTemplateIds?: string[];
  procedureNameForPlan?: string;
  forceConflict?: boolean;
}) {
  const sessionCount = input.slots.length;
  if (sessionCount < 2 || sessionCount > 52) {
    return {
      error: "Número de sessões deve ser entre 2 e 52.",
      ids: [] as string[],
      treatmentPlanId: null as string | null,
      partialSeries: false,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autorizado.", ids: [], treatmentPlanId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada.", ids: [], treatmentPlanId: null };
  }

  let serviceBillingMode: ServiceRecurrenceBillingMode = null;
  if (input.serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("recurrence_billing_mode")
      .eq("id", input.serviceId)
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();

    if (svc?.recurrence_billing_mode === "per_session" || svc?.recurrence_billing_mode === "treatment_plan") {
      serviceBillingMode = svc.recurrence_billing_mode;
    }
  }

  const billingModel = serviceModeToRecurrenceBilling(serviceBillingMode);

  if (
    billingModel &&
    profile.role !== "admin" &&
    profile.role !== "secretaria"
  ) {
    return { error: "Sem permissão para cobrança em série.", ids: [], treatmentPlanId: null };
  }

  const previewRes = await getAppointmentChargePreview(
    input.procedureIds,
    input.doctorId,
    input.serviceId,
    input.dimensionValueIds
  );
  const previewTotal = previewRes.data?.totalAmount ?? null;

  if (billingModel && (previewTotal == null || previewTotal <= 0)) {
    return {
      error:
        "Configure regras de preço em Serviços e Valores para este serviço/procedimento.",
      ids: [],
      treatmentPlanId: null,
      partialSeries: false,
    };
  }

  const planData = await getClinicPlanData();
  if (planData) {
    const currentMonthCount = await countMonthAppointments(profile.clinic_id);
    const projected = currentMonthCount + sessionCount;
    const check = canCreateAppointment(planData.limits, projected - 1);
    if (!check.allowed) {
      return {
        error: check.reason ?? "Limite de consultas/mês atingido.",
        ids: [],
        treatmentPlanId: null,
        partialSeries: false,
      };
    }
  }

  if (input.forceConflict && profile.role !== "admin") {
    return {
      error: "Apenas administradores podem forçar agendamento com conflito.",
      ids: [],
      treatmentPlanId: null,
      partialSeries: false,
    };
  }

  if (!input.forceConflict) {
    const conflictRes = await checkRecurrenceSlotsConflicts(
      input.doctorId,
      input.slots.map((s) => ({
        scheduledAt: s.scheduledAt,
        scheduledEndAt: s.scheduledEndAt,
      })),
      input.roomId
    );
    if (conflictRes.conflicts.some(Boolean)) {
      return {
        error: "Uma ou mais sessões estão em conflito de horário. Ajuste os horários ou use forçar agendamento (admin).",
        ids: [],
        treatmentPlanId: null,
        partialSeries: false,
      };
    }
  }

  const recurrenceGroupId = crypto.randomUUID();
  let treatmentPlanId: string | null = null;
  let valorPerSession: number | null = null;

  if (billingModel === "treatment_plan") {
    const total = (previewTotal ?? 0) * sessionCount;
    const planName =
      input.procedureNameForPlan?.trim() ||
      `Plano — ${sessionCount} sessões`;
    const { data: plan, error: planErr } = await supabase
      .from("treatment_plans")
      .insert({
        clinic_id: profile.clinic_id,
        patient_id: input.patientId,
        name: `${planName} — ${sessionCount} sessões`,
        total_amount: total,
        sessions_total: sessionCount,
        sessions_used: 0,
        payment_policy: "por_sessao",
        status: "ativo",
        service_id: input.serviceId ?? null,
        procedure_id: input.procedureIds?.[0] ?? null,
        created_by: user.id,
      })
      .select("id, payment_policy")
      .single();

    if (planErr) {
      if (planErr.message.includes("treatment_plans")) {
        return {
          error: "Migration operational-flow-extensions não aplicada.",
          ids: [],
          treatmentPlanId: null,
        };
      }
      return { error: planErr.message, ids: [], treatmentPlanId: null };
    }
    treatmentPlanId = String(plan.id);
    valorPerSession = total / sessionCount;
  } else if (billingModel === "independent") {
    valorPerSession = previewTotal;
  }

  const ids: string[] = [];
  const primaryProcedureId = input.procedureIds[0] ?? null;

  for (let i = 0; i < sessionCount; i++) {
    const sessionNumber = i + 1;
    const slot = input.slots[i];
    const res = await createAppointment(
      input.patientId,
      input.doctorId,
      input.appointmentTypeId,
      slot.scheduledAt,
      input.notes ?? null,
      input.recommendations ?? null,
      primaryProcedureId,
      false,
      false,
      input.specialInstructions ?? null,
      input.preparationNotes ?? null,
      i === 0 ? input.linkedFormTemplateIds : undefined,
      input.serviceId,
      valorPerSession,
      input.dimensionValueIds,
      input.procedureIds,
      {
        skipConflictCheck: !!input.forceConflict,
        forceConflict: input.forceConflict,
        recurrence_group_id: recurrenceGroupId,
        session_number: sessionNumber,
        treatment_plan_id: treatmentPlanId,
        skipRevalidate: i < sessionCount - 1,
        scheduledEndAt: slot.scheduledEndAt,
        roomId: input.roomId ?? null,
      }
    );

    if (res.error) {
      return {
        error: res.error,
        ids,
        treatmentPlanId,
        partialSeries: ids.length > 0,
      };
    }
    if (res.data?.id) ids.push(String(res.data.id));
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/eventos");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/planos-tratamento");
  if (treatmentPlanId) {
    revalidatePath(`/dashboard/planos-tratamento/${treatmentPlanId}`);
  }

  return { error: null, ids, treatmentPlanId, partialSeries: false };
}

// RECORRÊNCIA v1 — Lista consultas da mesma série.
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export async function getRecurrenceSeries(recurrenceGroupId: string): Promise<{
  error: string | null;
  patientName: string | null;
  appointments: RecurrenceSeriesAppointment[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", patientName: null, appointments: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada.", patientName: null, appointments: [] };
  }

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      session_number,
      scheduled_at,
      status,
      treatment_plan_id,
      patient:patients ( full_name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .eq("recurrence_group_id", recurrenceGroupId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    if (error.message.includes("recurrence_group_id")) {
      return {
        error: "Migration migration-recurrence-appointments não aplicada.",
        patientName: null,
        appointments: [],
      };
    }
    return { error: error.message, patientName: null, appointments: [] };
  }

  const first = data?.[0];
  const patient = first
    ? (Array.isArray(first.patient) ? first.patient[0] : first.patient)
    : null;

  return {
    error: null,
    patientName: (patient as { full_name?: string })?.full_name ?? null,
    appointments: (data ?? []).map((r) => ({
      id: String(r.id),
      session_number: r.session_number != null ? Number(r.session_number) : null,
      scheduled_at: String(r.scheduled_at),
      status: String(r.status),
      treatment_plan_id:
        r.treatment_plan_id != null ? String(r.treatment_plan_id) : null,
    })),
  };
}

// RECORRÊNCIA v1 — Reagenda uma sessão agendada da série.
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export async function updateRecurrenceSessionSchedule(
  appointmentId: string,
  scheduledAt: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: row } = await supabase
    .from("appointments")
    .select("status, recurrence_group_id")
    .eq("id", appointmentId)
    .single();

  if (!row?.recurrence_group_id) return { error: "Consulta não pertence a uma série." };
  if (row.status !== "agendada" && row.status !== "confirmada") {
    return { error: "Só é possível alterar sessões agendadas." };
  }

  const { updateAppointment } = await import("./actions");
  return updateAppointment(appointmentId, { scheduled_at: scheduledAt });
}

// RECORRÊNCIA v1 — Cancela uma sessão (status cancelada + estoque).
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export async function cancelRecurrenceSession(appointmentId: string) {
  const { updateAppointment } = await import("./actions");
  return updateAppointment(appointmentId, { status: "cancelada" });
}

// RECORRÊNCIA v1 — Cancela todas as sessões futuras agendadas da série.
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export async function cancelFutureRecurrenceSessions(recurrenceGroupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", cancelled: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", cancelled: 0 };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", cancelled: 0 };
  }

  const { data: rows } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("clinic_id", profile.clinic_id)
    .eq("recurrence_group_id", recurrenceGroupId)
    .in("status", ["agendada", "confirmada"]);

  const { updateAppointment } = await import("./actions");
  let cancelled = 0;
  for (const row of rows ?? []) {
    const res = await updateAppointment(String(row.id), { status: "cancelada" });
    if (!res.error) cancelled++;
  }

  revalidatePath("/dashboard/agenda");
  return { error: null, cancelled };
}

// RECORRÊNCIA v1 — Adiciona sessão ao fim da série (mesmo group_id).
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export async function addRecurrenceSession(input: {
  recurrenceGroupId: string;
  scheduledAt: string;
  copyFromAppointmentId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", id: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", id: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", id: null };
  }

  const { data: template } = await supabase
    .from("appointments")
    .select(
      `
      patient_id,
      doctor_id,
      appointment_type_id,
      procedure_id,
      service_id,
      notes,
      recommendations,
      requires_fasting,
      requires_medication_stop,
      special_instructions,
      preparation_notes,
      treatment_plan_id,
      valor,
      scheduled_end_at,
      room_id
    `
    )
    .eq("id", input.copyFromAppointmentId)
    .eq("recurrence_group_id", input.recurrenceGroupId)
    .single();

  if (!template) return { error: "Consulta de referência não encontrada.", id: null };

  const { data: siblings } = await supabase
    .from("appointments")
    .select("session_number")
    .eq("recurrence_group_id", input.recurrenceGroupId);

  const maxSession = Math.max(
    0,
    ...(siblings ?? []).map((s) => Number(s.session_number) || 0)
  );
  const nextSession = maxSession + 1;

  const { data: procRows } = await supabase
    .from("appointment_procedures")
    .select("procedure_id")
    .eq("appointment_id", input.copyFromAppointmentId);
  const procedureIds = (procRows ?? []).map((r) => String(r.procedure_id));
  if (!procedureIds.length && template.procedure_id) {
    procedureIds.push(String(template.procedure_id));
  }

  const addValor = template.treatment_plan_id ? null : template.valor;

  const res = await createAppointment(
    String(template.patient_id),
    String(template.doctor_id),
    template.appointment_type_id as string | null,
    input.scheduledAt,
    template.notes as string | null,
    template.recommendations as string | null,
    procedureIds[0] ?? null,
    !!template.requires_fasting,
    !!template.requires_medication_stop,
    template.special_instructions as string | null,
    template.preparation_notes as string | null,
    undefined,
    template.service_id as string | null,
    addValor != null ? Number(addValor) : null,
    undefined,
    procedureIds,
    {
      recurrence_group_id: input.recurrenceGroupId,
      session_number: nextSession,
      treatment_plan_id: template.treatment_plan_id as string | null,
      scheduledEndAt: template.scheduled_end_at
        ? String(template.scheduled_end_at)
        : undefined,
      roomId: template.room_id as string | null,
    }
  );

  if (res.error) return { error: res.error, id: null };
  revalidatePath("/dashboard/agenda");
  return { error: null, id: res.data?.id ? String(res.data.id) : null };
}

export type { RecurrenceFrequency } from "@/lib/recurrence-schedule";
