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
      description:
        "Busca se o paciente já está cadastrado pelo telefone desta conversa WhatsApp (automático — não peça telefone).\n" +
        "Use: início de agendamento, antes de create_appointment, ao cancelar/remarcar.\n" +
        "Não use: se patient_id já está no contexto; para cadastrar (use register_patient).\n" +
        "Retorno: found, patient_id, display_name. Se found=false, chame register_patient após obter o nome.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "register_patient",
      description:
        "Cadastra novo paciente. Telefone vem da conversa WhatsApp — não peça telefone.\n" +
        "Use: após lookup_patient_by_phone retornar found=false e paciente informar nome.\n" +
        "Não use: se paciente já cadastrado; sem nome completo.\n" +
        "Retorno: patientId em data.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string", description: "Nome completo informado pelo paciente" },
          email: { type: "string", description: "E-mail opcional" },
        },
        required: ["full_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_procedures",
      description:
        "Lista procedimentos da clínica com id, nome e duração.\n" +
        "Use: discovery (\"o que vocês fazem?\"), início de booking, paciente não sabe o procedimento.\n" +
        "Não use: se paciente já disse o procedimento; para preços (use get_service_price); para horários (use find_available_slots).\n" +
        "Parâmetro doctor_id: opcional, filtra procedimentos que o médico realiza.\n" +
        "Retorno: data.procedures + options indexadas (1, 2, 3). Se paciente responder número, use options[index].id como procedure_id.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string", description: "UUID do médico para filtrar procedimentos compatíveis" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_doctors",
      description:
        "Lista médicos da clínica com id, nome e especialidade.\n" +
        "Use: após procedimento definido, ou paciente pergunta quem atende.\n" +
        "Não use: se paciente já nomeou médico (\"com Dr. Daniel\") — busque correspondência na lista anterior ou chame novamente e faça match por nome.\n" +
        "Retorno: data.doctors + options indexadas (1, 2, 3). Se paciente responder \"1\" ou \"2\", use options[index].id como doctor_id.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description:
        "Busca disponibilidade de horários. Requer doctor_id e procedure_id (do contexto ou parâmetros).\n" +
        "Modos: sem date → retorna dias disponíveis (mode=days). Com date (YYYY-MM-DD) → horários do dia (mode=times).\n" +
        "Use: após médico e procedimento definidos; quando paciente pergunta \"tem vaga?\" ou escolhe dia/turno.\n" +
        "Não use: antes de ter doctor_id e procedure_id; para listar procedimentos/médicos.\n" +
        "period: \"manha\" ou \"tarde\" — filtra turno quando date informado.\n" +
        "skip_days: pule N dias já mostrados quando paciente pede \"outros dias\" ou \"próximos dias\".\n" +
        "Se status=unavailable: leia message e suggestion — re-chame com outros parâmetros (ex: sem date, skip_days, outro period).\n" +
        "Retorno success: data.slots ou data.days + options numeradas. unavailable: sem vagas no critério buscado.",
      parameters: {
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
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description:
        "Cria agendamento confirmado. Operação irreversível — só após confirmação explícita do paciente (\"sim\", \"pode marcar\").\n" +
        "Use: após find_available_slots, paciente escolheu horário e confirmou.\n" +
        "Não use: antes de find_available_slots; sem confirmação; horário fora de offered_slots.\n" +
        "Parâmetros: use IDs do contexto (patient_id, booking.procedure_id, booking.doctor_id, scheduled_at de offered_slots ou pending_slot).\n" +
        "Dependências: lookup_patient_by_phone ou register_patient → list_procedures → list_doctors → find_available_slots → confirmação → create_appointment.\n" +
        "Retorno: appointment_id, created=true.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string", description: "UUID do paciente" },
          doctor_id: { type: "string", description: "UUID do médico" },
          procedure_id: { type: "string", description: "UUID do procedimento" },
          scheduled_at: { type: "string", description: "ISO 8601 do horário escolhido (de find_available_slots)" },
        },
        required: ["patient_id", "doctor_id", "procedure_id", "scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_patient_appointments",
      description:
        "Lista consultas do paciente desta conversa (identificado pelo telefone).\n" +
        "Use: \"minhas consultas\", antes de cancel_appointment ou reschedule_appointment.\n" +
        "Não use: para agendar nova consulta.\n" +
        "Retorno: data.appointments + options se múltiplas. Use appointment_id das options se paciente escolher por número.",
      parameters: {
        type: "object",
        properties: {
          include_past: { type: "boolean", description: "true para incluir consultas passadas" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description:
        "Cancela consulta existente.\n" +
        "Use: paciente quer cancelar (não remarcar). Chame list_patient_appointments primeiro se houver múltiplas consultas.\n" +
        "Não use: se paciente quer remarcar — use cancellation_reason=reschedule (inicia fluxo de remarcação sem cancelar).\n" +
        "Confirme com paciente antes de executar.",
      parameters: {
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
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description:
        "Remarca consulta para novo horário.\n" +
        "Use: após find_available_slots para nova data e paciente confirmar.\n" +
        "Não use: scheduled_at inventado — deve vir de find_available_slots.\n" +
        "Parâmetro new_scheduled_at: ISO 8601 exato retornado por find_available_slots.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string", description: "UUID da consulta" },
          new_scheduled_at: { type: "string", description: "ISO 8601 do novo horário" },
        },
        required: ["appointment_id", "new_scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_price",
      description:
        "Consulta preço exato de procedimento/serviço para um médico.\n" +
        "Use: \"quanto custa?\", perguntas de valor.\n" +
        "Não use: para listar serviços (use list_procedures); para políticas/endereço (use search_faq).\n" +
        "Requer doctor_id e procedure_id (ou service_id). Retorno: valor em data.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string", description: "UUID do procedimento" },
          doctor_id: { type: "string", description: "UUID do médico" },
          service_id: { type: "string", description: "UUID do serviço (alternativa a procedure_id)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_faq",
      description:
        "Busca resposta em perguntas frequentes cadastradas (horário, endereço, políticas).\n" +
        "Use: dúvidas institucionais da clínica.\n" +
        "Não use: preços (get_service_price), procedimentos (list_procedures), horários disponíveis (find_available_slots).\n" +
        "Se unavailable: informe que não encontrou e tente tool específica — não transfira para humano.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Pergunta ou tema buscado" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Transfere conversa para atendente humano. Use APENAS quando:\n" +
        "- Paciente pede EXPLICITAMENTE falar com humano/atendente/pessoa\n" +
        "- Reclamação formal (Procon, advogado)\n" +
        "- Impossibilidade técnica real após tentar outras tools\n" +
        "NUNCA use durante booking ativo (procedimento/médico/horário em andamento).\n" +
        "NUNCA use por dúvida resolvível com list_procedures, find_available_slots, get_service_price ou search_faq.\n" +
        "NUNCA use porque paciente respondeu \"1\" ou \"2\" — interprete a seleção e continue o fluxo.\n" +
        "Parâmetro reason: descreva o motivo (ex: human_request, complaint).",
      parameters: {
        type: "object",
        properties: { reason: { type: "string", description: "Motivo objetivo da transferência" } },
        required: ["reason"],
      },
    },
  },
];

export function isChatbotTool(name: string): name is ChatbotToolName {
  return CHATBOT_SET.has(name);
}
