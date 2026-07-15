import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";
import { TOOL_DESCRIPTIONS } from "./tool-docs/descriptions";

export const CHATBOT_TOOL_NAMES = [
  "lookup_patient_by_phone",
  "register_patient",
  "update_patient_intake",
  "list_procedures",
  "get_procedure_info",
  "list_doctors",
  "find_available_slots",
  "create_appointment",
  "list_patient_appointments",
  "cancel_appointment",
  "reschedule_appointment",
  "perform_check_in",
  "get_service_price",
  "search_faq",
  "transfer_to_human",
] as const;

export type ChatbotToolName = (typeof CHATBOT_TOOL_NAMES)[number];

const CHATBOT_SET = new Set<string>(CHATBOT_TOOL_NAMES);

function toolDef(
  name: ChatbotToolName,
  parameters: ToolDefinition["function"]["parameters"]
): ToolDefinition {
  return {
    type: "function",
    function: {
      name,
      description: TOOL_DESCRIPTIONS[name],
      parameters,
    },
  };
}

export const CHATBOT_TOOLS: ToolDefinition[] = [
  toolDef("lookup_patient_by_phone", { type: "object", properties: {}, required: [] }),
  toolDef("register_patient", {
    type: "object",
    properties: {
      full_name: { type: "string", description: "Nome completo informado pelo paciente" },
      email: { type: "string", description: "E-mail opcional" },
    },
    required: ["full_name"],
  }),
  toolDef("update_patient_intake", {
    type: "object",
    properties: {
      patient_id: { type: "string", description: "UUID do paciente" },
      cpf: { type: "string", description: "CPF do paciente" },
      email: { type: "string", description: "E-mail do paciente" },
      insurance: { type: "string", description: "Convênio ou 'particular'" },
      payment_method: { type: "string", description: "Forma de pagamento preferida" },
      guardian: { type: "string", description: "Nome do responsável (menor de idade)" },
      cancel_reason: { type: "string", description: "Motivo do cancelamento" },
      custom_fields: {
        type: "object",
        description: "Campos personalizados { field_name: value }",
      },
    },
  }),
  toolDef("list_procedures", {
    type: "object",
    properties: {
      doctor_id: { type: "string", description: "UUID do médico para filtrar procedimentos compatíveis" },
    },
  }),
  toolDef("get_procedure_info", {
    type: "object",
    properties: {
      procedure_id: { type: "string", description: "UUID do procedimento" },
    },
    required: ["procedure_id"],
  }),
  toolDef("list_doctors", { type: "object", properties: {}, required: [] }),
  toolDef("find_available_slots", {
    type: "object",
    properties: {
      doctor_id: { type: "string", description: "UUID do médico" },
      procedure_id: { type: "string", description: "UUID do procedimento" },
      days_ahead: { type: "number", description: "Quantos dias à frente buscar (padrão 14)" },
      date: { type: "string", description: "Data YYYY-MM-DD escolhida pelo paciente" },
      period: { type: "string", enum: ["manha", "tarde"], description: "Turno preferido" },
      skip_days: { type: "number", description: "Pular N dias já oferecidos (paciente quer ver mais dias)" },
    },
    required: ["doctor_id", "procedure_id"],
  }),
  toolDef("create_appointment", {
    type: "object",
    properties: {
      patient_id: { type: "string", description: "UUID do paciente" },
      doctor_id: { type: "string", description: "UUID do médico" },
      procedure_id: { type: "string", description: "UUID do procedimento" },
      scheduled_at: {
        type: "string",
        description:
          "ISO 8601 exato de find_available_slots/offered_slots. Omita se booking.pending_slot já estiver definido — o runtime usa pending_slot.",
      },
    },
    required: ["patient_id", "doctor_id", "procedure_id"],
  }),
  toolDef("list_patient_appointments", {
    type: "object",
    properties: {
      include_past: { type: "boolean", description: "true para incluir consultas passadas" },
    },
  }),
  toolDef("cancel_appointment", {
    type: "object",
    properties: {
      appointment_id: { type: "string", description: "UUID da consulta" },
      cancellation_reason: {
        type: "string",
        enum: ["reschedule", "dropped", "other"],
        description: "reschedule=quer remarcar; dropped=desistiu; other=cancelamento",
      },
    },
    required: ["appointment_id"],
  }),
  toolDef("reschedule_appointment", {
    type: "object",
    properties: {
      appointment_id: { type: "string", description: "UUID da consulta" },
      new_scheduled_at: { type: "string", description: "ISO 8601 do novo horário" },
    },
    required: ["appointment_id", "new_scheduled_at"],
  }),
  toolDef("perform_check_in", {
    type: "object",
    properties: {
      appointment_id: {
        type: "string",
        description: "UUID da consulta (ou índice da lista / focused)",
      },
    },
  }),
  toolDef("get_service_price", {
    type: "object",
    properties: {
      procedure_id: { type: "string", description: "UUID do procedimento" },
      doctor_id: { type: "string", description: "UUID do médico" },
      service_id: { type: "string", description: "UUID do serviço (alternativa a procedure_id)" },
    },
  }),
  toolDef("search_faq", {
    type: "object",
    properties: { query: { type: "string", description: "Pergunta ou tema buscado" } },
    required: ["query"],
  }),
  toolDef("transfer_to_human", {
    type: "object",
    properties: { reason: { type: "string", description: "Motivo objetivo da transferência" } },
    required: ["reason"],
  }),
];

export function isChatbotTool(name: string): name is ChatbotToolName {
  return CHATBOT_SET.has(name);
}
