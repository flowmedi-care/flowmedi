import type { SupabaseClient } from "@supabase/supabase-js";
import { isVirtualAssistantActive } from "./process-inbound";
import { isInsideAutoMessageWindow } from "@/lib/whatsapp-ops-controls";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";
import {
  ensureWhatsAppConversation,
  sendAssistantOrTemplate,
} from "./send-assistant-or-template";
import { getTimeoutPolicy } from "@/lib/contact-journey/timeout-policy";
import {
  confirmationStepForTouchpoint,
  type ConfirmationTouchpoint,
} from "@/lib/contact-journey/confirmation-sequence";
import { logPipelineStageTransition } from "@/lib/virtual-assistant/agent-pipeline/transitions";
import {
  deriveRuntimeStage,
  syncDerivedPipelineStage,
} from "@/lib/virtual-assistant/conversation-state/derive-runtime-stage";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";
import type { AiConversationState } from "@/lib/virtual-assistant/types";

const CONFIRMATION_REQUEST_EVENT = "appointment_confirmation_request";
const CONFIRMATION_FOLLOWUP_EVENT = "appointment_confirmation_followup";
const REMINDER_7D_EVENT = "appointment_reminder_7d";

const FOLLOWUP_TOUCHPOINTS = [
  { hours: 12, touchpoint: "2d_followup_12h" },
  { hours: 24, touchpoint: "2d_followup_24h" },
] as const;

function formatAppointmentConfirmMessage(appt: {
  scheduled_at: string;
  doctor_name: string;
  procedure_name?: string;
}): string {
  const dt = new Date(appt.scheduled_at);
  const date = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const proc = appt.procedure_name ? ` (${appt.procedure_name})` : "";
  return `Olá! Passando para confirmar sua consulta${proc} com ${appt.doctor_name} no dia ${date} às ${time}. Você confirma presença? Responda *sim* ou *não*.`;
}

function formatLightReminder7d(appt: {
  scheduled_at: string;
  doctor_name: string;
}): string {
  const dt = new Date(appt.scheduled_at);
  const date = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Olá! Lembrete: você tem consulta com ${appt.doctor_name} no dia ${date} às ${time}. Estamos ansiosos para recebê-lo(a)!`;
}

function formatConfirmationFollowupMessage(appt: {
  scheduled_at: string;
  doctor_name: string;
}): string {
  const dt = new Date(appt.scheduled_at);
  const date = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Olá! Ainda não recebemos sua confirmação para a consulta com ${appt.doctor_name} no dia ${date} às ${time}. Responda *sim* ou *não*.`;
}

async function setPendingConfirmationState(
  supabase: SupabaseClient,
  conversationId: string,
  appointmentId: string,
  patientId: string
): Promise<void> {
  await supabase
    .from("whatsapp_conversations")
    .select("ai_state")
    .eq("id", conversationId)
    .maybeSingle()
    .then(async ({ data: conv }) => {
      const prev = (conv?.ai_state ?? {}) as AiConversationState;
      await supabase
        .from("whatsapp_conversations")
        .update({
          ai_state: {
            ...prev,
            intent: "confirm_appointment",
            pending_confirmation_appointment_id: appointmentId,
            patient_id: patientId,
          },
        })
        .eq("id", conversationId);
    });
}

/** Sincroniza journey_step + pipeline_stage após toque proativo D-7/D-2. */
async function syncComplianceTouchpointToConversation(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    touchpoint: ConfirmationTouchpoint;
    patientId: string;
    appointmentId: string;
  }
): Promise<void> {
  const journeyStep = confirmationStepForTouchpoint(opts.touchpoint);
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("ai_state")
    .eq("id", opts.conversationId)
    .maybeSingle();

  const prev = (conv?.ai_state ?? {}) as AiConversationState;
  const fromStage = prev.pipeline_stage as AgentPipelineStage | undefined;

  const baseState: AiConversationState = {
    ...prev,
    journey_step_code: journeyStep,
    patient_id: opts.patientId,
    ...(opts.touchpoint === "2d"
      ? {
          intent: "confirm_appointment" as const,
          pending_confirmation_appointment_id: opts.appointmentId,
        }
      : {}),
  };

  const derivedStage = deriveRuntimeStage({
    aiState: baseState,
    detectedIntent: "unknown",
  });
  const stagePatch = syncDerivedPipelineStage(baseState, derivedStage, "journey_step");
  const nextState: AiConversationState = { ...baseState, ...stagePatch };
  const toStage = derivedStage;

  await supabase
    .from("whatsapp_conversations")
    .update({ ai_state: nextState })
    .eq("id", opts.conversationId);

  if (fromStage !== toStage) {
    logPipelineStageTransition(supabase, {
      clinicId: opts.clinicId,
      conversationId: opts.conversationId,
      fromStage: fromStage ?? null,
      toStage,
      trigger: "event_auto",
      journeyStepCode: journeyStep,
    });
  }
}

/**
 * Follow-ups de confirmação (+12h / +24h) quando o paciente não respondeu ao toque 2d.
 */
async function runConfirmationFollowupsForClinic(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  const policy = getTimeoutPolicy("compliance_2d_enviado");
  const maxFollowups = policy?.maxAutoFollowups ?? 2;

  const { data: pendingOutreach } = await supabase
    .from("whatsapp_ai_confirmation_outreach")
    .select("id, appointment_id, conversation_id, sent_at")
    .eq("clinic_id", clinicId)
    .eq("touchpoint", "2d")
    .is("confirmed_at", null);

  const now = Date.now();

  for (const row of pendingOutreach ?? []) {
    const { data: appt } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, scheduled_at, status, profiles!appointments_doctor_id_fkey(full_name), patients(phone)"
      )
      .eq("id", row.appointment_id)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!appt || appt.status !== "agendada") continue;

    const hoursSince = (now - new Date(row.sent_at).getTime()) / (60 * 60 * 1000);
    const doctor = appt.profiles as { full_name?: string } | null;
    const patient = appt.patients as { phone?: string } | null;
    const phone = normalizeWhatsAppPhone(patient?.phone ?? "");
    if (!phone) continue;

    let followupIndex = 0;
    for (const step of FOLLOWUP_TOUCHPOINTS) {
      followupIndex++;
      if (followupIndex > maxFollowups) break;
      if (hoursSince < step.hours) continue;

      const { data: existing } = await supabase
        .from("whatsapp_ai_confirmation_outreach")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("touchpoint", step.touchpoint)
        .maybeSingle();

      if (existing) continue;

      let conversationId = row.conversation_id;
      if (!conversationId) {
        conversationId = await ensureWhatsAppConversation(supabase, clinicId, phone);
      }
      if (!conversationId) {
        errors++;
        continue;
      }

      const fallbackText = formatConfirmationFollowupMessage({
        scheduled_at: appt.scheduled_at,
        doctor_name: doctor?.full_name ?? "o profissional",
      });

      const result = await sendAssistantOrTemplate(supabase, {
        clinicId,
        conversationId,
        phoneNumber: phone,
        patientId: appt.patient_id,
        appointmentId: appt.id,
        eventCode: CONFIRMATION_FOLLOWUP_EVENT,
        fallbackText,
        eventMetadata: { touchpoint: step.touchpoint, followup_hours: step.hours },
      });

      if (result.success) {
        await supabase.from("whatsapp_ai_confirmation_outreach").insert({
          clinic_id: clinicId,
          appointment_id: appt.id,
          conversation_id: conversationId,
          touchpoint: step.touchpoint,
        });
        await setPendingConfirmationState(supabase, conversationId, appt.id, appt.patient_id);
        sent++;
      } else {
        errors++;
      }
    }
  }

  return { sent, errors };
}

/**
 * Envia mensagens proativas de confirmação de consulta via assistente virtual.
 */
export async function runVirtualAssistantConfirmations(
  supabase: SupabaseClient,
  clinicIdFilter?: string
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  let clinicsQuery = supabase
    .from("clinic_virtual_assistant_settings")
    .select("clinic_id, enabled")
    .eq("enabled", true);

  if (clinicIdFilter) {
    clinicsQuery = clinicsQuery.eq("clinic_id", clinicIdFilter);
  }

  const { data: enabledClinics } = await clinicsQuery;
  if (!enabledClinics?.length) return { sent, errors };

  for (const row of enabledClinics) {
    const clinicId = row.clinic_id;
    const { active } = await isVirtualAssistantActive(supabase, clinicId);
    if (!active) continue;

    if (!(await isInsideAutoMessageWindow(clinicId, supabase))) continue;

    const followupResult = await runConfirmationFollowupsForClinic(supabase, clinicId);
    sent += followupResult.sent;
    errors += followupResult.errors;

    const { data: clinic } = await supabase
      .from("clinics")
      .select("compliance_confirmation_days")
      .eq("id", clinicId)
      .single();

    const daysBefore = Number(clinic?.compliance_confirmation_days) || 2;

    // Toque leve 7 dias antes (não bloqueante)
    const target7Start = new Date();
    target7Start.setDate(target7Start.getDate() + 7);
    target7Start.setHours(0, 0, 0, 0);
    const target7End = new Date(target7Start);
    target7End.setHours(23, 59, 59, 999);

    const { data: appts7d } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, scheduled_at, status, patients(phone, full_name), profiles!appointments_doctor_id_fkey(full_name)"
      )
      .eq("clinic_id", clinicId)
      .in("status", ["agendada", "confirmada"])
      .gte("scheduled_at", target7Start.toISOString())
      .lte("scheduled_at", target7End.toISOString());

    for (const appt of appts7d ?? []) {
      const { data: existing7 } = await supabase
        .from("whatsapp_ai_confirmation_outreach")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("touchpoint", "7d")
        .maybeSingle();
      if (existing7) continue;

      const patient = appt.patients as { phone?: string; full_name?: string } | null;
      const phone = normalizeWhatsAppPhone(patient?.phone ?? "");
      if (!phone || !appt.patient_id) continue;

      const conversationId = await ensureWhatsAppConversation(supabase, clinicId, phone);
      if (!conversationId) {
        errors++;
        continue;
      }

      const doctor = appt.profiles as { full_name?: string } | null;
      const msg = formatLightReminder7d({
        scheduled_at: appt.scheduled_at,
        doctor_name: doctor?.full_name ?? "profissional",
      });

      const result = await sendAssistantOrTemplate(supabase, {
        clinicId,
        conversationId,
        phoneNumber: phone,
        patientId: appt.patient_id,
        appointmentId: appt.id,
        eventCode: REMINDER_7D_EVENT,
        fallbackText: msg,
        eventMetadata: { touchpoint: "7d" },
      });

      if (result.success) {
        await supabase.from("whatsapp_ai_confirmation_outreach").insert({
          clinic_id: clinicId,
          appointment_id: appt.id,
          conversation_id: conversationId,
          touchpoint: "7d",
        });
        await syncComplianceTouchpointToConversation(supabase, {
          clinicId,
          conversationId,
          touchpoint: "7d",
          patientId: appt.patient_id,
          appointmentId: appt.id,
        });
        sent++;
      } else {
        errors++;
      }
    }

    const targetStart = new Date();
    targetStart.setDate(targetStart.getDate() + daysBefore);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    const { data: appointments } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, scheduled_at, status, procedure_id, doctor_id, patients(phone, full_name), profiles!appointments_doctor_id_fkey(full_name), procedures(name)"
      )
      .eq("clinic_id", clinicId)
      .eq("status", "agendada")
      .gte("scheduled_at", targetStart.toISOString())
      .lte("scheduled_at", targetEnd.toISOString());

    for (const appt of appointments ?? []) {
      const { data: existing } = await supabase
        .from("whatsapp_ai_confirmation_outreach")
        .select("id")
        .eq("appointment_id", appt.id)
        .eq("touchpoint", "2d")
        .maybeSingle();

      if (existing) continue;

      const patient = appt.patients as { phone?: string; full_name?: string } | null;
      const phone = patient?.phone;
      if (!phone || !appt.patient_id) continue;

      const normalized = normalizeWhatsAppPhone(phone.replace(/\D/g, ""));
      const conversationId = await ensureWhatsAppConversation(supabase, clinicId, normalized);
      if (!conversationId) {
        errors++;
        continue;
      }

      const doctor = appt.profiles as { full_name?: string } | null;
      const procedure = appt.procedures as { name?: string } | null;
      const msg = formatAppointmentConfirmMessage({
        scheduled_at: appt.scheduled_at,
        doctor_name: doctor?.full_name ?? "o profissional",
        procedure_name: procedure?.name,
      });

      const result = await sendAssistantOrTemplate(supabase, {
        clinicId,
        conversationId,
        phoneNumber: normalized,
        patientId: appt.patient_id,
        appointmentId: appt.id,
        eventCode: CONFIRMATION_REQUEST_EVENT,
        fallbackText: msg,
        eventMetadata: { touchpoint: "2d" },
      });

      if (result.success) {
        await supabase.from("whatsapp_ai_confirmation_outreach").insert({
          clinic_id: clinicId,
          appointment_id: appt.id,
          conversation_id: conversationId,
          touchpoint: "2d",
        });
        await syncComplianceTouchpointToConversation(supabase, {
          clinicId,
          conversationId,
          touchpoint: "2d",
          patientId: appt.patient_id,
          appointmentId: appt.id,
        });
        await setPendingConfirmationState(
          supabase,
          conversationId,
          appt.id,
          appt.patient_id
        );
        sent++;
      } else {
        errors++;
      }
    }
  }

  return { sent, errors };
}

export type ConfirmationReply =
  | "yes"
  | "no_cancel"
  | "no_reschedule"
  | "clarify"
  | null;

/** Respostas à confirmação de presença — evita cancelar consulta por \"não\" ambíguo. */
export function parseConfirmationReply(text: string): ConfirmationReply {
  const t = text.toLowerCase().trim();
  if (/^(sim|confirmo|confirmado|ok|pode ser|vou|estarei|compareço|compareco)/.test(t)) {
    return "yes";
  }
  if (
    /(não vou|nao vou|não posso|nao posso|não consigo|nao consigo|cancelar|cancela|desmarcar|desmarca)/.test(
      t
    )
  ) {
    return "no_cancel";
  }
  if (/(remarcar|reagendar|outro horário|outro horario|mudar (o )?dia)/.test(t)) {
    return "no_reschedule";
  }
  if (/^(não|nao)$/.test(t)) {
    return "clarify";
  }
  return null;
}
