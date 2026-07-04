import type { ToolDefinition } from "../openai-client";

/** Definições OpenAI das ferramentas do assistente (sem lógica de execução). */
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
      description: "Lista médicos da clínica com especialidade. Use antes de agendar ou informar preço por profissional.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_procedures",
      description:
        "Lista procedimentos da clínica, opcionalmente filtrados por médico. Retorna nome e duração para apresentar ao paciente.",
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
      description:
        "Busca horários disponíveis para agendamento. Sem date: retorna dias disponíveis. Com date: retorna horários do dia (opcionalmente filtrados por turno manhã/tarde).",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          days_ahead: { type: "number", description: "Quantos dias à frente buscar (padrão 14)" },
          date: { type: "string", description: "Data escolhida pelo paciente no formato YYYY-MM-DD" },
          period: {
            type: "string",
            enum: ["manha", "tarde"],
            description: "Turno preferido: manhã ou tarde",
          },
          skip_days: {
            type: "number",
            description: "Pular N dias disponíveis (quando paciente pede outros dias)",
          },
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
      description:
        "Consulta preço exato de serviço/procedimento. Se needsDimensions=true, use dimension_value_ids das opções retornadas.",
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
      name: "list_price_options",
      description:
        "Lista opções de preço (convênio, turno, etc.) e faixa de valores para um procedimento ou serviço. Use quando o paciente perguntar quanto custa.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string" },
          service_id: { type: "string" },
          doctor_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_services",
      description:
        "Lista serviços da clínica com categoria, procedimentos vinculados e faixa de preço. Use quando o paciente não souber o nome do procedimento.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_patient_appointments",
      description:
        "Lista consultas futuras do paciente desta conversa (por telefone). Use quando perguntarem sobre agendamentos existentes.",
      parameters: {
        type: "object",
        properties: {
          include_past: { type: "boolean", description: "Se true, inclui consultas passadas também" },
        },
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
      description:
        "Cancela consulta do paciente. Use cancellation_reason=reschedule quando o paciente quer remarcar (não cancela de fato). Use dropped quando desistiu. Pergunte antes se ambíguo.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          cancellation_reason: {
            type: "string",
            enum: ["reschedule", "dropped", "other"],
            description: "reschedule = quer remarcar; dropped = desistiu; other = cancelamento genérico",
          },
        },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_journey",
      description:
        "Consulta a jornada do contato no CRM: etapa atual, eventos pendentes e próxima ação sugerida. Use antes de decidir cadastro, agendamento ou follow-up.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_quote_offer",
      description:
        "Verifica se pode gerar orçamento para um procedimento: se precisa perguntar médico, lista profissionais com preço e validade.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string" },
          doctor_id: { type: "string" },
        },
        required: ["procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_and_send_quote",
      description:
        "Cria orçamento, marca como enviado e manda resumo + PDF no WhatsApp. Só use após resolve_quote_offer sem needsDoctorChoice.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string" },
          doctor_id: { type: "string" },
        },
        required: ["procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote_status",
      description: "Consulta status do último orçamento do contato (enviado, expirado, etc.).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_form_status",
      description: "Lista formulários pendentes ou respondidos das consultas futuras do paciente.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "resend_form_link",
      description: "Reenvia link de formulário pendente quando o paciente pedir (não substitui compliance automático).",
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
      name: "get_payment_status",
      description:
        "Somente leitura: informa se há cobrança pendente no sistema. NUNCA registra pagamento.",
      parameters: { type: "object", properties: {}, required: [] },
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
          new_scheduled_at: { type: "string", description: "ISO 8601" },
        },
        required: ["appointment_id", "new_scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "collect_nps_feedback",
      description: "Registra nota NPS 0-10 e comentário opcional após atendimento.",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number" },
          comment: { type: "string" },
          appointment_id: { type: "string" },
        },
        required: ["score"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "infer_dropout_reason",
      description:
        "Analisa as últimas mensagens antes do silêncio e infere motivo provável de desistência (preço, horário, etc.). Registra em CRM.",
      parameters: {
        type: "object",
        properties: {
          journey_step: { type: "string", description: "Etapa CRM atual (opcional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Transfere para atendente humano. Use SOMENTE se o paciente pedir EXPLICITAMENTE para falar com atendente/pessoa humana. NUNCA use durante agendamento, dúvidas de horário ou quando não souber uma resposta — use as ferramentas.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    },
  },
];

export const ASSISTANT_TOOL_NAMES = ASSISTANT_TOOLS.map((t) => t.function.name);
