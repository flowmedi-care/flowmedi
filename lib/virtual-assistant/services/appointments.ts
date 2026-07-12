import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildScheduledEndFromDuration,
  plannedDurationMinutes,
  validateScheduledInterval,
  validateScheduledInFuture,
} from "@/lib/appointment-scheduling";
import {
  checkAppointmentConflict,
  clinicRequiresRoom,
  findFirstAvailableRoom,
  resolveProcedureDurationMinutes,
} from "@/lib/appointment-conflicts";
import { isScheduledAtInOfferedSlots } from "@/lib/booking-state";
import { canCreateAppointment, getUpgradeMessage } from "@/lib/plan-gates";
import {
  countMonthAppointmentsForClinic,
  getClinicPlanLimitsByClinicId,
} from "@/lib/plan-helpers";
import { buildConsumptionFromProcedures, commitStockForAppointment } from "@/lib/clinic-operations";
import type { OfferedSlot } from "@/lib/virtual-assistant/types";
import { resolveServicePriceForClinic } from "./pricing";
import type { IntakePendency } from "@/lib/attendance-flow/types";
import { lookupPatientsByPhone } from "./patients";
import {
  applyListAppointmentStages,
  LIST_PATIENT_APPOINTMENTS_SELECT,
  mapListedAppointmentRows,
  type ListAppointmentRow,
  type ListExecutionTrace,
  type ListQueryTailTrace,
} from "./list-appointments-trace";

export type CreateAppointmentConflict = {
  type: "conflict";
  message: string;
  conflictingAt?: string;
};

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string; conflict?: CreateAppointmentConflict };

export async function createAppointmentViaAssistant(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    patientId: string;
    doctorId: string;
    procedureId: string;
    scheduledAt: string;
    dimensionValueIds?: string[];
    serviceId?: string | null;
    offeredSlots?: OfferedSlot[];
    intakePendencies?: IntakePendency[];
  }
): Promise<CreateAppointmentResult> {
  const futureCheck = validateScheduledInFuture(opts.scheduledAt);
  if (!futureCheck.ok) return { ok: false, error: futureCheck.error };

  if (opts.offeredSlots?.length && !isScheduledAtInOfferedSlots(opts.scheduledAt, opts.offeredSlots)) {
    return {
      ok: false,
      error: "Horário não está entre as opções oferecidas. Escolha um horário da lista.",
      conflict: {
        type: "conflict",
        message: "Horário não está entre as opções oferecidas. Escolha um horário da lista.",
        conflictingAt: opts.scheduledAt,
      },
    };
  }

  const planLimits = await getClinicPlanLimitsByClinicId(supabase, opts.clinicId);
  if (planLimits) {
    const monthCount = await countMonthAppointmentsForClinic(supabase, opts.clinicId);
    const planCheck = canCreateAppointment(planLimits, monthCount);
    if (!planCheck.allowed) {
      return {
        ok: false,
        error: `${planCheck.reason ?? "Limite de consultas atingido."} ${getUpgradeMessage("consultas/mês")}`,
      };
    }
  }

  const durationMinutes = await resolveProcedureDurationMinutes(supabase, opts.clinicId, [opts.procedureId]);
  const scheduledEndAt = buildScheduledEndFromDuration(opts.scheduledAt, durationMinutes);
  const intervalCheck = validateScheduledInterval(opts.scheduledAt, scheduledEndAt);
  if (!intervalCheck.ok) return { ok: false, error: intervalCheck.error };

  let roomId: string | null = null;
  const roomRequired = await clinicRequiresRoom(supabase, opts.clinicId);
  if (roomRequired) {
    roomId = await findFirstAvailableRoom(supabase, {
      clinicId: opts.clinicId,
      scheduledAt: opts.scheduledAt,
      scheduledEndAt,
    });
    if (!roomId) {
      return {
        ok: false,
        error:
          "Esta clínica exige sala e não há sala livre neste horário. Peça à equipe para concluir o agendamento.",
        conflict: {
          type: "conflict",
          message:
            "Esta clínica exige sala e não há sala livre neste horário.",
          conflictingAt: opts.scheduledAt,
        },
      };
    }
  }

  const conflict = await checkAppointmentConflict(supabase, {
    clinicId: opts.clinicId,
    doctorId: opts.doctorId,
    scheduledAt: opts.scheduledAt,
    scheduledEndAt,
    roomId,
    excludeAppointmentId: null,
  });
  if (conflict) {
    return {
      ok: false,
      error: conflict,
      conflict: {
        type: "conflict",
        message: conflict,
        conflictingAt: opts.scheduledAt,
      },
    };
  }

  let serviceId = opts.serviceId ?? null;
  if (!serviceId) {
    const { data: proc } = await supabase
      .from("procedures")
      .select("default_service_id, recommendations")
      .eq("id", opts.procedureId)
      .single();
    serviceId = proc?.default_service_id ?? null;
  }

  let valor: number | null = null;
  if (serviceId) {
    const priceRes = await resolveServicePriceForClinic(
      supabase,
      opts.clinicId,
      serviceId,
      opts.doctorId,
      opts.dimensionValueIds ?? []
    );
    valor = priceRes.valor;
  }

  const { data: procData } = await supabase
    .from("procedures")
    .select("recommendations")
    .eq("id", opts.procedureId)
    .single();

  const { data: appointment, error: insertErr } = await supabase
    .from("appointments")
    .insert({
      clinic_id: opts.clinicId,
      patient_id: opts.patientId,
      doctor_id: opts.doctorId,
      procedure_id: opts.procedureId,
      service_id: serviceId,
      valor,
      scheduled_at: opts.scheduledAt,
      scheduled_end_at: scheduledEndAt,
      planned_duration_minutes: plannedDurationMinutes(opts.scheduledAt, scheduledEndAt),
      status: "agendada",
      recommendations: procData?.recommendations ?? null,
      created_by: null,
      intake_pendencies: opts.intakePendencies?.length ? opts.intakePendencies : [],
      ...(roomId ? { room_id: roomId } : {}),
    })
    .select("id")
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };
  if (!appointment?.id) return { ok: false, error: "Erro ao criar consulta." };

  await supabase.from("appointment_procedures").insert({
    appointment_id: appointment.id,
    procedure_id: opts.procedureId,
  });

  try {
    await buildConsumptionFromProcedures(supabase, appointment.id, [opts.procedureId]);
    await commitStockForAppointment(supabase, opts.clinicId, appointment.id);
  } catch (e) {
    console.warn("[VirtualAssistant] stock commit:", e);
  }

  if (opts.dimensionValueIds?.length) {
    await supabase.from("appointment_dimension_values").insert(
      opts.dimensionValueIds.map((dimension_value_id) => ({
        appointment_id: appointment.id,
        dimension_value_id,
      }))
    );
  }

  try {
    const { data: eventId } = await supabase.rpc("create_event_timeline", {
      p_clinic_id: opts.clinicId,
      p_event_code: "appointment_created",
      p_patient_id: opts.patientId,
      p_appointment_id: appointment.id,
      p_metadata: { source: "virtual_assistant" },
    });
    if (eventId) {
      const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
      const { isInsideAutoMessageWindow } = await import("@/lib/whatsapp-ops-controls");
      if (await isInsideAutoMessageWindow(opts.clinicId, supabase)) {
        await runAutoSendForEvent(eventId, opts.clinicId, "appointment_created", supabase);
      }
    }
  } catch (e) {
    console.error("[VirtualAssistant] appointment_created event:", e);
  }

  try {
    const { linkFormsToAppointment } = await import("@/lib/forms/link-forms-to-appointment");
    const { data: patient } = await supabase
      .from("patients")
      .select("email")
      .eq("id", opts.patientId)
      .maybeSingle();
    await linkFormsToAppointment(supabase, {
      clinicId: opts.clinicId,
      appointmentId: appointment.id,
      procedureId: opts.procedureId,
      patientEmail: patient?.email ? String(patient.email) : null,
    });
  } catch (e) {
    console.warn("[VirtualAssistant] link forms:", e);
  }

  return { ok: true, appointmentId: appointment.id };
}

export async function formatAppointmentConfirmationMessage(
  supabase: SupabaseClient,
  opts: { clinicId: string; appointmentId: string; patientId: string }
): Promise<string> {
  const { data: appt } = await supabase
    .from("appointments")
    .select(
      "scheduled_at, profiles!appointments_doctor_id_fkey(full_name), procedures!procedure_id(name), recommendations"
    )
    .eq("id", opts.appointmentId)
    .eq("clinic_id", opts.clinicId)
    .eq("patient_id", opts.patientId)
    .maybeSingle();

  if (!appt) {
    return "Sua consulta foi registrada no sistema. Em breve você recebe os detalhes por aqui.";
  }

  const dt = new Date(appt.scheduled_at as string);
  const date = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const doctor = (appt.profiles as { full_name?: string } | null)?.full_name ?? "o profissional";
  const procedure = (appt.procedures as { name?: string } | null)?.name;
  const procPart = procedure ? ` de ${procedure}` : "";

  let msg = `Pronto! Sua consulta${procPart} com ${doctor} está confirmada para ${date} às ${time}.`;
  const rec = appt.recommendations as string | null;
  if (rec?.trim()) {
    msg += `\n\nRecomendações:\n${rec.trim()}`;
  }
  return msg;
}

export async function confirmAppointmentViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  patientId: string
): Promise<{ error: string | null; recommendations: string | null }> {
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, status, recommendations, procedure_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .single();

  if (!appt || appt.patient_id !== patientId) {
    return { error: "Consulta não encontrada.", recommendations: null };
  }
  if (appt.status === "confirmada") {
    return { error: null, recommendations: appt.recommendations as string | null };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "confirmada" })
    .eq("id", appointmentId);

  if (error) return { error: error.message, recommendations: null };

  try {
    await supabase.rpc("create_event_timeline", {
      p_clinic_id: clinicId,
      p_event_code: "appointment_confirmed",
      p_patient_id: patientId,
      p_appointment_id: appointmentId,
      p_metadata: { source: "virtual_assistant" },
    });
  } catch (e) {
    console.error("[VirtualAssistant] appointment_confirmed event:", e);
  }

  let recommendations = (appt.recommendations as string | null) ?? null;
  if (!recommendations && appt.procedure_id) {
    const { data: proc } = await supabase
      .from("procedures")
      .select("recommendations")
      .eq("id", appt.procedure_id)
      .single();
    recommendations = proc?.recommendations ?? null;
  }

  return { error: null, recommendations };
}

/**
 * Cancelamento via assistente (webhook/cron) — usa service-role, sem wizard humano.
 * Não dispara WhatsApp de cancelamento (paciente acabou de interagir).
 */
export async function cancelAppointmentViaAssistantOperational(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  patientId: string
): Promise<{ error: string | null }> {
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, status")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .single();

  if (!appt || appt.patient_id !== patientId) {
    return { error: "Consulta não encontrada." };
  }
  if (appt.status === "cancelada") return { error: null };
  if (appt.status !== "agendada" && appt.status !== "confirmada") {
    return {
      error:
        "Só é possível cancelar consultas agendadas ou confirmadas. Esta já foi realizada, marcada como falta ou não está ativa.",
    };
  }

  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, paid_amount, status")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .maybeSingle();

  if (comanda && Number(comanda.paid_amount) > 0) {
    return {
      error:
        "Consulta com pagamento registrado. Cancele pelo dashboard da clínica para definir estorno ou crédito.",
    };
  }

  if (comanda) {
    const now = new Date().toISOString();
    const { error: comandaErr } = await supabase
      .from("comandas")
      .update({
        status: "cancelada",
        cancelled_at: now,
        cancelled_reason: "Cancelamento via assistente virtual",
      })
      .eq("id", comanda.id);
    if (comandaErr) return { error: comandaErr.message };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelada" })
    .eq("id", appointmentId);

  if (error) return { error: error.message };

  try {
    await supabase.rpc("create_event_timeline", {
      p_clinic_id: clinicId,
      p_event_code: "appointment_canceled",
      p_patient_id: patientId,
      p_appointment_id: appointmentId,
      p_metadata: { source: "virtual_assistant", skip_whatsapp_send: true },
    });
  } catch (e) {
    console.error("[VirtualAssistant] appointment_canceled event:", e);
  }

  return { error: null };
}

export async function cancelAppointmentViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  patientId: string
): Promise<{ error: string | null }> {
  return cancelAppointmentViaAssistantOperational(
    supabase,
    clinicId,
    appointmentId,
    patientId
  );
}

export async function listPatientAppointmentsViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  opts?: { upcomingOnly?: boolean }
): Promise<
  {
    id: string;
    scheduled_at: string;
    status: string;
    doctor_id?: string | null;
    procedure_id?: string | null;
    doctor_name: string | null;
    procedure_name: string | null;
    valor: number | null;
    patient_id?: string;
  }[]
> {
  const { appointments } = await listPatientAppointmentsViaAssistantWithTail(
    supabase,
    clinicId,
    patientId,
    opts
  );
  return appointments;
}

/**
 * Functional list + observability tail (query → error → data.length → afterMap).
 * Callers that only need rows should use `listPatientAppointmentsViaAssistant`.
 */
export async function listPatientAppointmentsViaAssistantWithTail(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  opts?: { upcomingOnly?: boolean }
): Promise<{
  appointments: Awaited<ReturnType<typeof listPatientAppointmentsViaAssistant>>;
  queryTail: ListQueryTailTrace;
}> {
  const upcomingOnly = opts?.upcomingOnly !== false;
  const nowIso = new Date().toISOString();
  const select = LIST_PATIENT_APPOINTMENTS_SELECT;

  let query = supabase
    .from("appointments")
    .select(select)
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["agendada", "confirmada"])
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (upcomingOnly) {
    query = query.gte("scheduled_at", nowIso);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[listPatientAppointmentsViaAssistant] query failed:", error.message, {
      clinicId,
      patientId,
      upcomingOnly,
      select,
    });
  }

  const rows = data ?? [];
  const appointments = mapListedAppointmentRows(
    rows as Parameters<typeof mapListedAppointmentRows>[0],
    patientId
  ).map((row) => ({
    id: row.id,
    scheduled_at: row.scheduled_at,
    status: row.status,
    doctor_id: row.doctor_id ?? null,
    procedure_id: row.procedure_id ?? null,
    doctor_name: row.doctor_name ?? null,
    procedure_name: row.procedure_name ?? null,
    valor: row.valor ?? null,
    patient_id: row.patient_id,
  }));

  return {
    appointments,
    queryTail: {
      queryExecuted: { select, upcomingOnly, nowIso },
      supabaseError: error?.message ?? null,
      supabaseDataLength: rows.length,
      afterMap: appointments.length,
    },
  };
}

type ListedAppointment = Awaited<ReturnType<typeof listPatientAppointmentsViaAssistant>>[number];

/** Raw rows for surgical replay (all statuses, no date floor). */
async function fetchAppointmentRowsForListTrace(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string
): Promise<ListAppointmentRow[]> {
  const { data } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, patient_id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    scheduled_at: String(row.scheduled_at),
    status: String(row.status),
    patient_id: row.patient_id ? String(row.patient_id) : patientId,
  }));
}

function buildListExecutionTrace(input: {
  clinicId: string;
  phone: string;
  matchedPatientIds: string[];
  selectedPatientId: string;
  resolvedPatientId: string;
  usedPhoneFallback: boolean;
  upcomingOnly: boolean;
  rawSelected: ListAppointmentRow[];
  resultCount: number;
  nowIso: string;
  queryTail?: ListQueryTailTrace;
}): ListExecutionTrace {
  const staged = applyListAppointmentStages(input.rawSelected, {
    upcomingOnly: input.upcomingOnly,
    nowIso: input.nowIso,
  });
  return {
    clinicId: input.clinicId,
    phone: input.phone,
    matchedPatientIds: input.matchedPatientIds,
    patientsMatchedByPhone: input.matchedPatientIds.length,
    selectedPatientId: input.selectedPatientId,
    resolvedPatientId: input.resolvedPatientId,
    usedPhoneFallback: input.usedPhoneFallback,
    effectiveFilters: {
      statuses: ["agendada", "confirmada"],
      upcomingOnly: input.upcomingOnly,
    },
    stages: {
      beforeFilters: staged.counts.totalForSelectedPatient,
      afterStatusFilter: staged.counts.cancelable,
      afterDateFilter: staged.afterDate.length,
      resultCount: input.resultCount,
    },
    ...(input.queryTail ? { queryTail: input.queryTail } : {}),
    counts: staged.counts,
  };
}

async function listCancelableForPatientPreferUpcoming(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  upcomingOnly: boolean
): Promise<{ appointments: ListedAppointment[]; queryTail: ListQueryTailTrace }> {
  let listed = await listPatientAppointmentsViaAssistantWithTail(
    supabase,
    clinicId,
    patientId,
    { upcomingOnly }
  );
  // Overdue canceláveis: retry only when the requested filter was upcoming-only and empty.
  if (listed.appointments.length === 0 && upcomingOnly) {
    const retry = await listPatientAppointmentsViaAssistantWithTail(
      supabase,
      clinicId,
      patientId,
      { upcomingOnly: false }
    );
    // Keep first queryTail (the upcoming attempt) if retry also empty; prefer retry tail when it finds rows.
    if (retry.appointments.length > 0) {
      return retry;
    }
    return {
      appointments: [],
      queryTail: {
        ...listed.queryTail,
        // Preserve both attempts in error string when both failed empty.
        supabaseError:
          listed.queryTail.supabaseError ??
          retry.queryTail.supabaseError ??
          (listed.queryTail.supabaseDataLength === 0 && retry.queryTail.supabaseDataLength === 0
            ? listed.queryTail.supabaseError
            : null),
      },
    };
  }
  return listed;
}

/**
 * List cancellable appointments for patient_id first.
 * Legacy fallback: if empty, union by phone across duplicate patient rows (does not make phone identity).
 * Observability: `listExecutionTrace` is for ToolTrace / playground debug only — not the LLM payload.
 */
export async function listCancellableAppointmentsWithPhoneFallback(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    patientId: string;
    phone: string;
    upcomingOnly?: boolean;
  }
): Promise<{
  appointments: ListedAppointment[];
  resolvedPatientId: string;
  usedPhoneFallback: boolean;
  listExecutionTrace: ListExecutionTrace;
}> {
  const upcomingOnly = opts.upcomingOnly !== false;
  const nowIso = new Date().toISOString();

  const siblings = await lookupPatientsByPhone(supabase, opts.clinicId, opts.phone);
  const matchedPatientIds = siblings.map((s) => s.id);
  const rawSelected = await fetchAppointmentRowsForListTrace(
    supabase,
    opts.clinicId,
    opts.patientId
  );

  // Primary: upcoming first; if empty, overdue canceláveis (same policy as before — now also when siblings exist).
  const primary = await listCancelableForPatientPreferUpcoming(
    supabase,
    opts.clinicId,
    opts.patientId,
    upcomingOnly
  );
  let appointments = primary.appointments;
  const queryTail = primary.queryTail;

  if (appointments.length > 0) {
    return {
      appointments,
      resolvedPatientId: opts.patientId,
      usedPhoneFallback: false,
      listExecutionTrace: buildListExecutionTrace({
        clinicId: opts.clinicId,
        phone: opts.phone,
        matchedPatientIds,
        selectedPatientId: opts.patientId,
        resolvedPatientId: opts.patientId,
        usedPhoneFallback: false,
        upcomingOnly,
        rawSelected,
        resultCount: appointments.length,
        nowIso,
        queryTail,
      }),
    };
  }

  const otherIds = matchedPatientIds.filter((id) => id !== opts.patientId);
  if (otherIds.length === 0) {
    return {
      appointments: [],
      resolvedPatientId: opts.patientId,
      usedPhoneFallback: false,
      listExecutionTrace: buildListExecutionTrace({
        clinicId: opts.clinicId,
        phone: opts.phone,
        matchedPatientIds,
        selectedPatientId: opts.patientId,
        resolvedPatientId: opts.patientId,
        usedPhoneFallback: false,
        upcomingOnly,
        rawSelected,
        resultCount: 0,
        nowIso,
        queryTail,
      }),
    };
  }

  const merged: ListedAppointment[] = [];
  const seen = new Set<string>();
  for (const id of otherIds) {
    const { appointments: rows } = await listCancelableForPatientPreferUpcoming(
      supabase,
      opts.clinicId,
      id,
      upcomingOnly
    );
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  }
  merged.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const resolvedPatientId =
    merged[0]?.patient_id && merged.every((a) => a.patient_id === merged[0]?.patient_id)
      ? String(merged[0].patient_id)
      : opts.patientId;

  return {
    appointments: merged,
    resolvedPatientId: merged.length ? resolvedPatientId : opts.patientId,
    usedPhoneFallback: merged.length > 0,
    listExecutionTrace: buildListExecutionTrace({
      clinicId: opts.clinicId,
      phone: opts.phone,
      matchedPatientIds,
      selectedPatientId: opts.patientId,
      resolvedPatientId: merged.length ? resolvedPatientId : opts.patientId,
      usedPhoneFallback: merged.length > 0,
      upcomingOnly,
      rawSelected,
      resultCount: merged.length,
      nowIso,
      queryTail,
    }),
  };
}

export async function rescheduleAppointmentViaAssistant(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    appointmentId: string;
    patientId: string;
    newScheduledAt: string;
  }
): Promise<{ error: string | null }> {
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, procedure_id, status, scheduled_at")
    .eq("id", opts.appointmentId)
    .eq("clinic_id", opts.clinicId)
    .single();

  if (!appt || appt.patient_id !== opts.patientId) {
    return { error: "Consulta não encontrada." };
  }
  if (!["agendada", "confirmada"].includes(String(appt.status))) {
    return { error: "Esta consulta não pode ser remarcada." };
  }

  const futureCheck = validateScheduledInFuture(opts.newScheduledAt);
  if (!futureCheck.ok) return { error: futureCheck.error };

  const durationMinutes = await resolveProcedureDurationMinutes(supabase, opts.clinicId, [
    String(appt.procedure_id),
  ]);
  const scheduledEndAt = buildScheduledEndFromDuration(opts.newScheduledAt, durationMinutes);
  const intervalCheck = validateScheduledInterval(opts.newScheduledAt, scheduledEndAt);
  if (!intervalCheck.ok) return { error: intervalCheck.error };

  const conflict = await checkAppointmentConflict(supabase, {
    clinicId: opts.clinicId,
    doctorId: String(appt.doctor_id),
    scheduledAt: opts.newScheduledAt,
    scheduledEndAt,
    excludeAppointmentId: opts.appointmentId,
  });
  if (conflict) return { error: conflict };

  const { error } = await supabase
    .from("appointments")
    .update({
      scheduled_at: opts.newScheduledAt,
      scheduled_end_at: scheduledEndAt,
      planned_duration_minutes: plannedDurationMinutes(opts.newScheduledAt, scheduledEndAt),
      status: "agendada",
    })
    .eq("id", opts.appointmentId);

  if (error) return { error: error.message };

  try {
    const { data: eventId } = await supabase.rpc("create_event_timeline", {
      p_clinic_id: opts.clinicId,
      p_event_code: "appointment_rescheduled",
      p_patient_id: opts.patientId,
      p_appointment_id: opts.appointmentId,
      p_metadata: {
        source: "virtual_assistant",
        old_scheduled_at: appt.scheduled_at,
        new_scheduled_at: opts.newScheduledAt,
      },
    });
    if (eventId) {
      const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
      const { isInsideAutoMessageWindow } = await import("@/lib/whatsapp-ops-controls");
      if (await isInsideAutoMessageWindow(opts.clinicId, supabase)) {
        await runAutoSendForEvent(eventId, opts.clinicId, "appointment_rescheduled", supabase);
      }
    }
  } catch (e) {
    console.warn("[reschedule] event:", e);
  }

  return { error: null };
}
