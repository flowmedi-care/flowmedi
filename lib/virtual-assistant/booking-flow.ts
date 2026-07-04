import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationState, BookingStep } from "./types";
import { isMetaFlowQuestion, buildMetaFlowReply } from "./reply-guards";
import { lookupPatientByPhone, registerPatientViaAssistant, linkConversationToPatient } from "./services/patients";
import { createAppointmentViaAssistant, formatAppointmentConfirmationMessage } from "./services/appointments";

export type BookingFlowResult =
  | { handled: true; reply: string; statePatch: Partial<AiConversationState> }
  | { handled: false };

function nextStep(current: BookingStep | undefined): BookingStep {
  const order: BookingStep[] = ["procedure", "doctor", "day", "slot", "patient", "confirm", "done"];
  if (!current) return "procedure";
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)]!;
}

/** Respostas determinísticas para meta-perguntas e bootstrap — sem OpenAI. */
export async function tryHandleBookingMeta(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    messageText: string;
    aiState: AiConversationState;
  }
): Promise<BookingFlowResult> {
  const text = opts.messageText.trim();
  if (!text) return { handled: false };

  if (isMetaFlowQuestion(text)) {
    const reply = buildMetaFlowReply(opts.aiState);
    if (reply) return { handled: true, reply, statePatch: {} };
  }

  if (/n[aã]o tem (o |meu )?telefone|vc n[aã]o tem|você não tem.*telefone/i.test(text)) {
    return {
      handled: true,
      reply:
        "Já tenho seu número pelo WhatsApp — não preciso que você informe. " +
        (opts.aiState.booking_step === "patient" || !opts.aiState.patient_id
          ? "Só falta confirmar seu nome completo para finalizar."
          : "Vamos seguir com o agendamento."),
      statePatch: {},
    };
  }

  return { handled: false };
}

export async function bootstrapPatientForBooking(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    aiState: AiConversationState;
  }
): Promise<{ statePatch: Partial<AiConversationState>; promptLine: string }> {
  if (opts.aiState.patient_id) {
    const { data } = await supabase
      .from("patients")
      .select("full_name")
      .eq("id", opts.aiState.patient_id)
      .maybeSingle();
    return {
      statePatch: {},
      promptLine: data?.full_name
        ? `Paciente cadastrado: ${data.full_name} (id interno). Telefone WhatsApp já vinculado.`
        : "Paciente identificado. Telefone WhatsApp já vinculado.",
    };
  }

  const patient = await lookupPatientByPhone(supabase, opts.clinicId, opts.phoneNumber);
  if (patient) {
    await linkConversationToPatient(supabase, opts.clinicId, opts.conversationId, patient.id);
    return {
      statePatch: { patient_id: patient.id, booking_step: opts.aiState.booking_step ?? "procedure" },
      promptLine: `Paciente cadastrado: ${patient.full_name}. Telefone WhatsApp já vinculado — NUNCA pedir telefone.`,
    };
  }

  return {
    statePatch: { booking_step: opts.aiState.booking_step ?? "procedure" },
    promptLine:
      "Paciente ainda não cadastrado. Telefone WhatsApp já disponível — use register_patient só com nome. NUNCA pedir telefone.",
  };
}

/** Após create_appointment bem-sucedido — mensagem template sem LLM. */
export async function buildPostCreateReply(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    appointmentId: string;
    patientId: string;
  }
): Promise<string> {
  return formatAppointmentConfirmationMessage(supabase, opts);
}

export function patchBookingStepFromTool(
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
  current: AiConversationState
): Partial<AiConversationState> {
  switch (toolName) {
    case "list_procedures":
      return { booking_step: "procedure", intent: "booking" };
    case "list_doctors":
      return { booking_step: "doctor", intent: "booking" };
    case "find_available_slots":
      if (args.date) {
        return {
          booking_step: "slot",
          intent: "booking",
          doctor_id: String(args.doctor_id ?? current.doctor_id ?? ""),
          procedure_id: String(args.procedure_id ?? current.procedure_id ?? ""),
          pending_slot: result.slots ? JSON.stringify(result.slots).slice(0, 200) : current.pending_slot,
        };
      }
      return {
        booking_step: "day",
        intent: "booking",
        doctor_id: String(args.doctor_id ?? current.doctor_id ?? ""),
        procedure_id: String(args.procedure_id ?? current.procedure_id ?? ""),
      };
    case "lookup_patient_by_phone":
      return result.id
        ? { booking_step: "confirm", patient_id: String(result.id), intent: "booking" }
        : { booking_step: "patient", intent: "booking" };
    case "register_patient":
      return result.patientId
        ? { booking_step: "confirm", patient_id: String(result.patientId), intent: "booking" }
        : { booking_step: "patient", intent: "booking" };
    case "create_appointment":
      if (result.appointmentId) {
        return {
          booking_step: "done",
          last_created_appointment_id: String(result.appointmentId),
          intent: undefined,
          pending_slot: undefined,
          offered_slots: undefined,
          offered_days: undefined,
          last_slot_query: undefined,
          last_display_message: undefined,
        };
      }
      return { booking_step: "confirm", intent: "booking" };
    default:
      return {};
  }
}

export { nextStep };
