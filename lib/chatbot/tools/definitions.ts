import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";

export const CHATBOT_TOOL_NAMES = [
  "lookup_patient_by_phone",
  "register_patient",
  "list_procedures",
  "list_doctors",
  "find_available_slots",
  "create_appointment",
  "list_patient_appointments",
  "cancel_appointment",
  "reschedule_appointment",
  "get_service_price",
  "search_faq",
  "transfer_to_human",
] as const;

export type ChatbotToolName = (typeof CHATBOT_TOOL_NAMES)[number];

const CHATBOT_SET = new Set<string>(CHATBOT_TOOL_NAMES);

export const CHATBOT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "lookup_patient_by_phone",
      description: "Busca paciente cadastrado pelo telefone da conversa WhatsApp.",
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
      name: "list_procedures",
      description: "Lista procedimentos da clínica, opcionalmente filtrados por médico.",
      parameters: {
        type: "object",
        properties: { doctor_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_doctors",
      description: "Lista médicos da clínica com especialidade.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description:
        "Busca horários disponíveis. Sem date: retorna dias. Com date: retorna horários do dia.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          days_ahead: { type: "number" },
          date: { type: "string", description: "YYYY-MM-DD" },
          period: { type: "string", enum: ["manha", "tarde"] },
          skip_days: { type: "number" },
        },
        required: ["doctor_id", "procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Cria agendamento após confirmação do paciente.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          scheduled_at: { type: "string", description: "ISO 8601" },
        },
        required: ["patient_id", "doctor_id", "procedure_id", "scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_patient_appointments",
      description: "Lista consultas do paciente (futuras por padrão).",
      parameters: {
        type: "object",
        properties: { include_past: { type: "boolean" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancela consulta. Use cancellation_reason=reschedule se o paciente quer remarcar.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          cancellation_reason: { type: "string", enum: ["reschedule", "dropped", "other"] },
        },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Remarca consulta para novo horário ISO 8601.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          new_scheduled_at: { type: "string" },
        },
        required: ["appointment_id", "new_scheduled_at"],
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
          procedure_id: { type: "string" },
          doctor_id: { type: "string" },
          service_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_faq",
      description: "Busca resposta em perguntas frequentes da clínica (horário, endereço, políticas).",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description: "Transfere conversa para atendente humano.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  },
];

export function isChatbotTool(name: string): name is ChatbotToolName {
  return CHATBOT_SET.has(name);
}
