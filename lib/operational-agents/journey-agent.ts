import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactJourney, SuggestedAction } from "@/lib/contact-journey";
import {
  isCommercialFollowupStep,
  sendCommercialFollowup,
} from "@/lib/virtual-assistant/commercial-followup";
import { logAgentRun } from "./agent-runs";
import { fetchJourneyListForClinic } from "./journey-list";

export type JourneyAgentResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    contactKey: string;
    displayName: string;
    action: string;
    success: boolean;
    error?: string;
  }>;
};

async function registerLeadPatient(
  supabase: SupabaseClient,
  clinicId: string,
  email: string,
  data: {
    full_name: string;
    phone?: string | null;
    birth_date?: string | null;
  },
  eventId?: string
): Promise<{ patientId: string | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("email", email)
    .maybeSingle();

  let patientId: string;

  if (existing?.id) {
    patientId = existing.id;
    const { error } = await supabase
      .from("patients")
      .update({
        full_name: data.full_name,
        phone: data.phone?.replace(/\D/g, "") || null,
        birth_date: data.birth_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId);
    if (error) return { patientId: null, error: error.message };
  } else {
    const { data: newPatient, error } = await supabase
      .from("patients")
      .insert({
        clinic_id: clinicId,
        full_name: data.full_name,
        email,
        phone: data.phone?.replace(/\D/g, "") || null,
        birth_date: data.birth_date || null,
        custom_fields: {},
      })
      .select("id")
      .single();
    if (error || !newPatient?.id) {
      return { patientId: null, error: error?.message ?? "Erro ao cadastrar paciente." };
    }
    patientId = newPatient.id;
  }

  await supabase.rpc("create_event_timeline", {
    p_clinic_id: clinicId,
    p_event_code: "patient_registered",
    p_patient_id: patientId,
    p_appointment_id: null,
    p_form_instance_id: null,
    p_origin: "agent",
    p_metadata: { source: "journey_agent" },
  });

  if (eventId) {
    await supabase
      .from("event_timeline")
      .update({ patient_id: patientId })
      .eq("id", eventId)
      .eq("clinic_id", clinicId);
  }

  return { patientId, error: null };
}

async function setAppointmentStatus(
  supabase: SupabaseClient,
  clinicId: string,
  appointmentId: string,
  status: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);
  return { error: error?.message ?? null };
}

async function advancePipelineStage(
  supabase: SupabaseClient,
  clinicId: string,
  pipelineId: string,
  newStage: string
): Promise<{ error: string | null }> {
  const { data: current } = await supabase
    .from("non_registered_pipeline")
    .select("stage")
    .eq("id", pipelineId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!current) return { error: "Lead não encontrado." };

  const { error } = await supabase
    .from("non_registered_pipeline")
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq("id", pipelineId)
    .eq("clinic_id", clinicId);

  if (!error) {
    await supabase.from("non_registered_history").insert({
      pipeline_id: pipelineId,
      action_type: "stage_change",
      old_stage: current.stage,
      new_stage: newStage,
      notes: "Avançado pelo Journey Agent",
    });
  }

  return { error: error?.message ?? null };
}

async function findConversationForJourney(
  supabase: SupabaseClient,
  clinicId: string,
  journey: ContactJourney
): Promise<{ id: string; phone_number: string } | null> {
  const phone = journey.phone?.replace(/\D/g, "");
  if (!phone) return null;

  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone_number")
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const match = (data ?? []).find((c) =>
    c.phone_number?.replace(/\D/g, "").endsWith(phone.slice(-8))
  );
  return match ? { id: match.id, phone_number: match.phone_number } : null;
}

async function executeJourneyAction(
  supabase: SupabaseClient,
  clinicId: string,
  journey: ContactJourney,
  action: SuggestedAction
): Promise<{ success: boolean; error?: string }> {
  switch (action.kind) {
    case "register_patient": {
      const email = journey.email ?? (action.metadata?.public_submitter_email as string);
      if (!email) return { success: false, error: "Email não disponível para cadastro." };
      const res = await registerLeadPatient(
        supabase,
        clinicId,
        email,
        {
          full_name:
            (action.metadata?.public_submitter_name as string) || journey.displayName,
          phone: (action.metadata?.public_submitter_phone as string) || journey.phone || null,
          birth_date: (action.metadata?.public_submitter_birth_date as string) || null,
        },
        action.eventId
      );
      return res.error ? { success: false, error: res.error } : { success: true };
    }

    case "mark_appointment_done": {
      if (!action.appointmentId) return { success: false, error: "Consulta não identificada." };
      const res = await setAppointmentStatus(supabase, clinicId, action.appointmentId, "realizada");
      return res.error ? { success: false, error: res.error } : { success: true };
    }

    case "contact_lead":
    case "send_form_reminder": {
      const conv = await findConversationForJourney(supabase, clinicId, journey);
      if (!conv) {
        if (journey.pipelineId) {
          await advancePipelineStage(supabase, clinicId, journey.pipelineId, "aguardando_retorno");
        }
        return { success: true };
      }

      if (journey.patientId && isCommercialFollowupStep(journey.currentStep)) {
        const res = await sendCommercialFollowup(supabase, {
          clinicId,
          conversationId: conv.id,
          phoneNumber: conv.phone_number,
          patientId: journey.patientId,
          journeyStep: journey.currentStep,
        });
        return res.success
          ? { success: true }
          : { success: false, error: res.error ?? "Falha ao enviar follow-up." };
      }

      const { sendAssistantReply } = await import("@/lib/virtual-assistant/send-reply");
      await sendAssistantReply(
        supabase,
        clinicId,
        conv.id,
        conv.phone_number,
        `Olá ${journey.displayName.split(" ")[0]}! Posso ajudar com o próximo passo do seu atendimento?`
      );
      return { success: true };
    }

    case "schedule_appointment":
    case "schedule_return":
    case "reschedule_appointment": {
      const conv = await findConversationForJourney(supabase, clinicId, journey);
      if (!conv) return { success: false, error: "WhatsApp não encontrado para este contato." };

      if (journey.patientId) {
        const { sendAssistantOrTemplate } = await import(
          "@/lib/virtual-assistant/send-assistant-or-template"
        );
        const res = await sendAssistantOrTemplate(supabase, {
          clinicId,
          conversationId: conv.id,
          phoneNumber: conv.phone_number,
          patientId: journey.patientId,
          eventCode: "booking_abandoned_followup",
          fallbackText:
            "Olá! Vamos agendar sua consulta? Me diga qual dia e turno (manhã ou tarde) funcionam melhor.",
          eventMetadata: { journey_step: journey.currentStep, source: "journey_agent" },
        });
        if (!res.success) {
          return { success: false, error: res.error ?? "Falha ao iniciar agendamento." };
        }
      } else {
        const { sendAssistantReply } = await import("@/lib/virtual-assistant/send-reply");
        await sendAssistantReply(
          supabase,
          clinicId,
          conv.id,
          conv.phone_number,
          "Olá! Vamos agendar sua consulta? Me diga qual dia e turno (manhã ou tarde) funcionam melhor."
        );
      }

      if (journey.pipelineId && action.kind === "schedule_appointment") {
        await advancePipelineStage(supabase, clinicId, journey.pipelineId, "negociacao");
      }

      return { success: true };
    }

    case "collect_payment":
    case "escalate_human":
      return { success: false, error: "Ação requer validação humana — não automatizada." };

    case "link_form":
    case "view_event":
    case "view_quote":
    case "none":
      return { success: false, error: "Ação apenas de navegação — ignorada pelo agente." };

    default:
      return { success: false, error: `Ação não suportada: ${action.kind}` };
  }
}

export async function runJourneyAgentBatch(
  supabase: SupabaseClient,
  clinicId: string,
  limit = 20
): Promise<JourneyAgentResult> {
  const startedAt = Date.now();
  await logAgentRun(supabase, {
    clinicId,
    agentType: "journey",
    status: "running",
    action: "batch_run",
    detail: { limit },
  });

  const journeys = await fetchJourneyListForClinic(supabase, clinicId, {
    withPendingAction: true,
  });

  const pending = journeys.filter((j) => j.suggestedAction).slice(0, limit);
  const result: JourneyAgentResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  for (const journey of pending) {
    const action = journey.suggestedAction!;
    result.processed++;

    await logAgentRun(supabase, {
      clinicId,
      agentType: "journey",
      status: "running",
      action: action.kind,
      contactId: journey.contactKey,
      detail: { displayName: journey.displayName, step: journey.currentStep },
    });

    const exec = await executeJourneyAction(supabase, clinicId, journey, action);

    await logAgentRun(supabase, {
      clinicId,
      agentType: "journey",
      status: exec.success ? "done" : "failed",
      action: action.kind,
      contactId: journey.contactKey,
      detail: { displayName: journey.displayName, error: exec.error },
    });

    result.results.push({
      contactKey: journey.contactKey,
      displayName: journey.displayName,
      action: action.kind,
      success: exec.success,
      error: exec.error,
    });

    if (exec.success) result.succeeded++;
    else if (exec.error?.includes("ignorada") || exec.error?.includes("navegação")) result.skipped++;
    else result.failed++;
  }

  await logAgentRun(supabase, {
    clinicId,
    agentType: "journey",
    status: "done",
    action: "batch_run",
    detail: {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    },
    durationMs: Date.now() - startedAt,
  });

  return result;
}
