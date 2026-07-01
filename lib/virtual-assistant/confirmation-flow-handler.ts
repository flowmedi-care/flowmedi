import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cancelAppointmentViaAssistantOperational,
  confirmAppointmentViaAssistant,
} from "./services/appointments";
import { sendAssistantReply } from "./send-reply";
import type { AiConversationState } from "./types";
import {
  parseConfirmationButtonReplyId,
  parseConfirmationFlowAction,
  type ConfirmationFlowAction,
} from "./confirmation-flow-token";

export type ParsedFlowInbound = {
  action: ConfirmationFlowAction;
  appointmentId?: string;
  patientId?: string;
  clinicId?: string;
  source: "nfm_reply" | "button_reply" | "text_marker";
};

export function parseFlowResponseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseInteractiveInboundMessage(msg: Record<string, unknown>): ParsedFlowInbound | null {
  const interactive = msg.interactive as Record<string, unknown> | undefined;
  if (!interactive) return null;

  const interactiveType = String(interactive.type ?? "");

  if (interactiveType === "nfm_reply") {
    const nfm = interactive.nfm_reply as Record<string, unknown> | undefined;
    const responseJson = String(nfm?.response_json ?? "");
    if (!responseJson) return null;
    const data = parseFlowResponseJson(responseJson);
    if (!data) return null;
    const action =
      parseConfirmationFlowAction(data.action) ??
      parseConfirmationFlowAction(data.resposta) ??
      parseConfirmationFlowAction(data.choice);
    if (!action) return null;
    return {
      action,
      appointmentId: data.appointment_id ? String(data.appointment_id) : undefined,
      patientId: data.patient_id ? String(data.patient_id) : undefined,
      clinicId: data.clinic_id ? String(data.clinic_id) : undefined,
      source: "nfm_reply",
    };
  }

  if (interactiveType === "button_reply") {
    const button = interactive.button_reply as Record<string, unknown> | undefined;
    const id = String(button?.id ?? "");
    const action = parseConfirmationButtonReplyId(id);
    if (!action) return null;
    return { action, source: "button_reply" };
  }

  return null;
}

export type ConfirmationFlowHandleResult = {
  handled: boolean;
  scheduleAi?: boolean;
  reply?: string;
};

export async function handleConfirmationFlowInbound(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    parsed: ParsedFlowInbound;
    messageId?: string;
  }
): Promise<ConfirmationFlowHandleResult> {
  const { clinicId, conversationId, phoneNumber, parsed, messageId } = opts;

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("ai_state")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const aiState = (conv?.ai_state ?? {}) as AiConversationState;
  const appointmentId =
    parsed.appointmentId ?? aiState.pending_confirmation_appointment_id ?? undefined;
  const patientId = parsed.patientId ?? aiState.patient_id ?? undefined;

  if (!appointmentId || !patientId) {
    return {
      handled: true,
      reply:
        "Não encontrei a consulta para confirmar. Por favor, entre em contato com a recepção.",
    };
  }

  const now = new Date().toISOString();

  if (parsed.action === "confirmar") {
    const res = await confirmAppointmentViaAssistant(
      supabase,
      clinicId,
      appointmentId,
      patientId
    );
    if (res.error) {
      return { handled: true, reply: `Não foi possível confirmar: ${res.error}` };
    }

    await supabase
      .from("whatsapp_ai_confirmation_outreach")
      .update({ confirmed_at: now })
      .eq("appointment_id", appointmentId);

    const nextState: AiConversationState = {
      ...aiState,
      pending_confirmation_appointment_id: undefined,
      intent: undefined,
    };
    await supabase
      .from("whatsapp_conversations")
      .update({ ai_state: nextState })
      .eq("id", conversationId);

    let reply = "Perfeito! Sua consulta está confirmada. ✅";
    if (res.recommendations) {
      reply += `\n\n📋 Recomendações:\n${res.recommendations}`;
    }
    if (messageId) {
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("id", messageId);
    }
    await sendAssistantReply(supabase, clinicId, conversationId, phoneNumber, reply);
    return { handled: true, reply };
  }

  if (parsed.action === "cancelar") {
    const res = await cancelAppointmentViaAssistantOperational(
      supabase,
      clinicId,
      appointmentId,
      patientId
    );
    const reply = res.error
      ? `Não foi possível cancelar: ${res.error}`
      : "Entendido. Sua consulta foi cancelada. Se quiser remarcar, é só me avisar!";

    await supabase
      .from("whatsapp_conversations")
      .update({
        ai_state: {
          ...aiState,
          pending_confirmation_appointment_id: undefined,
          intent: undefined,
        },
      })
      .eq("id", conversationId);

    if (messageId) {
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("id", messageId);
    }
    await sendAssistantReply(supabase, clinicId, conversationId, phoneNumber, reply);
    return { handled: true, reply };
  }

  if (parsed.action === "remarcar") {
    const nextState: AiConversationState = {
      ...aiState,
      intent: "reschedule",
      pending_reschedule_appointment_id: appointmentId,
      patient_id: patientId,
      pending_confirmation_appointment_id: undefined,
    };
    await supabase
      .from("whatsapp_conversations")
      .update({ ai_state: nextState })
      .eq("id", conversationId);

    if (messageId) {
      await supabase
        .from("whatsapp_messages")
        .update({ ai_processed_at: now })
        .eq("id", messageId);
    }

    const reply =
      "Sem problemas! Vou te ajudar a remarcar. Me diga qual dia e horário funcionam melhor para você.";
    await sendAssistantReply(supabase, clinicId, conversationId, phoneNumber, reply);
    return { handled: true, scheduleAi: true, reply };
  }

  return { handled: false };
}
