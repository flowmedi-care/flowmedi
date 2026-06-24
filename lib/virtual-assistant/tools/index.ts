import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolDefinition } from "../openai-client";
import { findAvailableSlots } from "@/lib/appointment-conflicts";
import {
  cancelAppointmentViaAssistant,
  confirmAppointmentViaAssistant,
  createAppointmentViaAssistant,
} from "../services/appointments";
import {
  linkConversationToPatient,
  lookupPatientByPhone,
  registerPatientViaAssistant,
} from "../services/patients";
import { getProcedureInfo, resolveServicePriceForClinic } from "../services/pricing";
import { applyRoutingOnNewConversation } from "@/lib/whatsapp-routing";
import type { AiConversationState } from "../types";

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "lookup_patient_by_phone",
      description: "Busca paciente cadastrado pelo telefone da conversa.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "register_patient",
      description: "Cadastra novo paciente com nome e telefone.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          email: { type: "string" },
        },
        required: ["full_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_doctors",
      description: "Lista médicos da clínica.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_procedures",
      description: "Lista procedimentos, opcionalmente filtrados por médico.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description: "Busca horários disponíveis para agendamento.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          days_ahead: { type: "number" },
        },
        required: ["doctor_id", "procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Cria agendamento para paciente cadastrado.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          scheduled_at: { type: "string", description: "ISO 8601" },
          dimension_value_ids: { type: "array", items: { type: "string" } },
        },
        required: ["patient_id", "doctor_id", "procedure_id", "scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_procedure_info",
      description: "Detalhes e recomendações de um procedimento.",
      parameters: {
        type: "object",
        properties: { procedure_id: { type: "string" } },
        required: ["procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_price",
      description: "Consulta preço de serviço/procedimento.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string" },
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          dimension_value_ids: { type: "array", items: { type: "string" } },
        },
        required: ["doctor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_appointment",
      description: "Confirma presença em consulta agendada.",
      parameters: {
        type: "object",
        properties: { appointment_id: { type: "string" } },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancela consulta do paciente.",
      parameters: {
        type: "object",
        properties: { appointment_id: { type: "string" } },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description: "Transfere conversa para atendimento humano.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    },
  },
];

async function logToolCall(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  toolName: string,
  params: Record<string, unknown>,
  resultSummary: string,
  success: boolean
): Promise<void> {
  await supabase.from("whatsapp_ai_tool_log").insert({
    clinic_id: clinicId,
    conversation_id: conversationId,
    tool_name: toolName,
    params,
    result_summary: resultSummary.slice(0, 500),
    success,
  });
}

export type ToolContext = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  aiState: AiConversationState;
};

export async function executeAssistantTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string; handoff?: boolean; statePatch?: Partial<AiConversationState> }> {
  const { supabase, clinicId, conversationId, phoneNumber } = ctx;

  try {
    switch (name) {
      case "lookup_patient_by_phone": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        const summary = patient ? `Paciente: ${patient.full_name}` : "Paciente não cadastrado";
        await logToolCall(supabase, clinicId, conversationId, name, {}, summary, true);
        return {
          result: JSON.stringify(patient ?? { found: false }),
          statePatch: patient ? { patient_id: patient.id } : {},
        };
      }

      case "register_patient": {
        const fullName = String(args.full_name ?? "").trim();
        if (!fullName) {
          return { result: JSON.stringify({ error: "Nome obrigatório." }) };
        }
        const res = await registerPatientViaAssistant(supabase, clinicId, {
          full_name: fullName,
          phone: phoneNumber,
          email: args.email ? String(args.email) : null,
        });
        if (res.patientId) {
          await linkConversationToPatient(supabase, clinicId, conversationId, res.patientId);
        }
        await logToolCall(supabase, clinicId, conversationId, name, { full_name: fullName }, res.error ?? "ok", !res.error);
        return {
          result: JSON.stringify(res),
          statePatch: res.patientId ? { patient_id: res.patientId } : {},
        };
      }

      case "list_doctors": {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("clinic_id", clinicId)
          .eq("role", "medico")
          .order("full_name");
        await logToolCall(supabase, clinicId, conversationId, name, {}, `${data?.length ?? 0} médicos`, true);
        return { result: JSON.stringify(data ?? []) };
      }

      case "list_procedures": {
        const doctorId = args.doctor_id ? String(args.doctor_id) : null;
        let procedureIds: string[] | null = null;
        if (doctorId) {
          const { data: dp } = await supabase
            .from("doctor_procedures")
            .select("procedure_id")
            .eq("clinic_id", clinicId)
            .eq("doctor_id", doctorId);
          procedureIds = (dp ?? []).map((r) => r.procedure_id);
        }
        let query = supabase
          .from("procedures")
          .select("id, name, duration_minutes")
          .eq("clinic_id", clinicId)
          .order("display_order");
        if (procedureIds) {
          if (!procedureIds.length) return { result: JSON.stringify([]) };
          query = query.in("id", procedureIds);
        }
        const { data } = await query;
        await logToolCall(supabase, clinicId, conversationId, name, { doctor_id: doctorId }, `${data?.length ?? 0} procedimentos`, true);
        return { result: JSON.stringify(data ?? []) };
      }

      case "find_available_slots": {
        const doctorId = String(args.doctor_id);
        const procedureId = String(args.procedure_id);
        const daysAhead = Number(args.days_ahead) || 14;
        const slots = await findAvailableSlots(supabase, {
          clinicId,
          doctorId,
          procedureId,
          daysAhead,
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, `${slots.length} slots`, true);
        return {
          result: JSON.stringify(slots),
          statePatch: { doctor_id: doctorId, procedure_id: procedureId, intent: "booking" },
        };
      }

      case "create_appointment": {
        const res = await createAppointmentViaAssistant(supabase, {
          clinicId,
          patientId: String(args.patient_id),
          doctorId: String(args.doctor_id),
          procedureId: String(args.procedure_id),
          scheduledAt: String(args.scheduled_at),
          dimensionValueIds: (args.dimension_value_ids as string[]) ?? [],
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? res.appointmentId ?? "ok", !res.error);
        return {
          result: JSON.stringify(res),
          statePatch: res.appointmentId ? { intent: undefined, pending_slot: undefined } : {},
        };
      }

      case "get_procedure_info": {
        const info = await getProcedureInfo(supabase, clinicId, String(args.procedure_id));
        await logToolCall(supabase, clinicId, conversationId, name, args, info?.name ?? "n/a", !!info);
        return { result: JSON.stringify(info ?? { error: "Não encontrado" }) };
      }

      case "get_service_price": {
        let serviceId = args.service_id ? String(args.service_id) : null;
        const doctorId = String(args.doctor_id);
        if (!serviceId && args.procedure_id) {
          const proc = await getProcedureInfo(supabase, clinicId, String(args.procedure_id));
          serviceId = proc?.default_service_id ?? null;
        }
        if (!serviceId) {
          return { result: JSON.stringify({ error: "Serviço não configurado para este procedimento." }) };
        }
        const price = await resolveServicePriceForClinic(
          supabase,
          clinicId,
          serviceId,
          doctorId,
          (args.dimension_value_ids as string[]) ?? []
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, String(price.valor), !price.error);
        return { result: JSON.stringify({ service_id: serviceId, ...price }) };
      }

      case "confirm_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const res = await confirmAppointmentViaAssistant(
          supabase,
          clinicId,
          String(args.appointment_id),
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "confirmada", !res.error);
        return { result: JSON.stringify(res) };
      }

      case "cancel_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const res = await cancelAppointmentViaAssistant(
          supabase,
          clinicId,
          String(args.appointment_id),
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "cancelada", !res.error);
        return { result: JSON.stringify(res) };
      }

      case "transfer_to_human": {
        await supabase
          .from("whatsapp_conversations")
          .update({
            ai_handoff_at: new Date().toISOString(),
            ai_enabled: false,
          })
          .eq("id", conversationId);
        await applyRoutingOnNewConversation(supabase, clinicId, conversationId);
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          String(args.reason ?? "handoff"),
          true
        );
        return { result: JSON.stringify({ transferred: true }), handoff: true };
      }

      default:
        return { result: JSON.stringify({ error: `Ferramenta desconhecida: ${name}` }) };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na ferramenta";
    await logToolCall(supabase, clinicId, conversationId, name, args, msg, false);
    return { result: JSON.stringify({ error: msg }) };
  }
}
