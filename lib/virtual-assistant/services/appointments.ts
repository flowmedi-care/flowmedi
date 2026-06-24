import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildScheduledEndFromDuration,
  plannedDurationMinutes,
  validateScheduledInterval,
} from "@/lib/appointment-scheduling";
import {
  checkAppointmentConflict,
  resolveProcedureDurationMinutes,
} from "@/lib/appointment-conflicts";
import { resolveServicePriceForClinic } from "./pricing";

async function clinicRequiresRoom(supabase: SupabaseClient, clinicId: string): Promise<boolean> {
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("active", true);
  return (count ?? 0) > 0;
}

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
  }
): Promise<{ appointmentId: string | null; error: string | null }> {
  const durationMinutes = await resolveProcedureDurationMinutes(supabase, opts.clinicId, [opts.procedureId]);
  const scheduledEndAt = buildScheduledEndFromDuration(opts.scheduledAt, durationMinutes);
  const intervalCheck = validateScheduledInterval(opts.scheduledAt, scheduledEndAt);
  if (!intervalCheck.ok) return { appointmentId: null, error: intervalCheck.error };

  const roomRequired = await clinicRequiresRoom(supabase, opts.clinicId);
  if (roomRequired) {
    return { appointmentId: null, error: "Esta clínica exige sala. Peça à equipe para concluir o agendamento." };
  }

  const conflict = await checkAppointmentConflict(supabase, {
    clinicId: opts.clinicId,
    doctorId: opts.doctorId,
    scheduledAt: opts.scheduledAt,
    scheduledEndAt,
    excludeAppointmentId: null,
  });
  if (conflict) return { appointmentId: null, error: conflict };

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
    })
    .select("id")
    .single();

  if (insertErr) return { appointmentId: null, error: insertErr.message };
  if (!appointment?.id) return { appointmentId: null, error: "Erro ao criar consulta." };

  await supabase.from("appointment_procedures").insert({
    appointment_id: appointment.id,
    procedure_id: opts.procedureId,
  });

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

  return { appointmentId: appointment.id, error: null };
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

export async function cancelAppointmentViaAssistant(
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

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelada" })
    .eq("id", appointmentId);

  return { error: error?.message ?? null };
}
