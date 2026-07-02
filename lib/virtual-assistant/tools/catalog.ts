export type AssistantToolCategory =
  | "paciente"
  | "agendamento"
  | "precos"
  | "comercial"
  | "crm"
  | "formulario"
  | "financeiro"
  | "atendimento";

export type AssistantToolCatalogEntry = {
  name: string;
  label: string;
  category: AssistantToolCategory;
  description: string;
  whenToUse: string;
};

export const ASSISTANT_TOOL_CATEGORY_LABELS: Record<AssistantToolCategory, string> = {
  paciente: "Paciente",
  agendamento: "Agendamento",
  precos: "Preços e serviços",
  comercial: "Orçamentos",
  crm: "Jornada do cliente (CRM)",
  formulario: "Formulários",
  financeiro: "Financeiro (somente leitura)",
  atendimento: "Atendimento",
};

/** Catálogo legível das ferramentas expostas à OpenAI (espelha ASSISTANT_TOOLS). */
export const ASSISTANT_TOOL_CATALOG: AssistantToolCatalogEntry[] = [
  {
    name: "lookup_patient_by_phone",
    label: "Buscar paciente",
    category: "paciente",
    description: "Busca paciente cadastrado pelo telefone da conversa.",
    whenToUse: "Antes de agendar ou consultar consultas de quem já é paciente.",
  },
  {
    name: "register_patient",
    label: "Cadastrar paciente",
    category: "paciente",
    description: "Cadastra novo paciente com nome e telefone (e-mail opcional).",
    whenToUse: "Quando o contato ainda não existe no cadastro e vai agendar.",
  },
  {
    name: "list_doctors",
    label: "Listar médicos",
    category: "agendamento",
    description: "Lista médicos da clínica com especialidade.",
    whenToUse: "Antes de agendar ou informar preço por profissional.",
  },
  {
    name: "list_procedures",
    label: "Listar procedimentos",
    category: "agendamento",
    description: "Lista procedimentos com nome e duração, opcionalmente por médico.",
    whenToUse: "Quando o paciente pergunta o que a clínica oferece ou qual procedimento agendar.",
  },
  {
    name: "find_available_slots",
    label: "Buscar horários",
    category: "agendamento",
    description:
      "Busca dias ou horários disponíveis para médico + procedimento. Sem date: lista dias. Com date: lista horários do dia (opcionalmente por turno manhã/tarde).",
    whenToUse:
      "Depois que médico e procedimento estão definidos. Primeiro sem date (dias), depois com date quando o paciente escolher dia ou turno. Use display_message retornado — nunca invente horários.",
  },
  {
    name: "create_appointment",
    label: "Criar agendamento",
    category: "agendamento",
    description: "Cria consulta para paciente já cadastrado.",
    whenToUse: "Após paciente escolher horário e confirmar dados.",
  },
  {
    name: "list_patient_appointments",
    label: "Listar consultas",
    category: "agendamento",
    description: "Lista consultas futuras (ou passadas) do paciente desta conversa.",
    whenToUse: "Quando perguntam sobre agendamentos existentes ou próxima consulta.",
  },
  {
    name: "confirm_appointment",
    label: "Confirmar consulta",
    category: "agendamento",
    description: "Confirma presença em consulta agendada.",
    whenToUse: "Quando o paciente responde sim à confirmação de consulta.",
  },
  {
    name: "cancel_appointment",
    label: "Cancelar consulta",
    category: "agendamento",
    description: "Cancela consulta do paciente.",
    whenToUse: "Quando o paciente pede para desmarcar.",
  },
  {
    name: "get_procedure_info",
    label: "Info do procedimento",
    category: "precos",
    description: "Detalhes e recomendações de um procedimento.",
    whenToUse: "Dúvidas sobre preparo, indicação ou descrição de um procedimento.",
  },
  {
    name: "get_service_price",
    label: "Consultar preço",
    category: "precos",
    description: "Preço exato de serviço/procedimento (com convênio, turno, etc.).",
    whenToUse: "Quando o paciente quer valor final após escolher opções.",
  },
  {
    name: "list_price_options",
    label: "Opções de preço",
    category: "precos",
    description: "Lista convênios, turnos e faixa de valores.",
    whenToUse: "Quando perguntam quanto custa sem saber convênio ou modalidade.",
  },
  {
    name: "list_services",
    label: "Listar serviços",
    category: "precos",
    description: "Lista serviços com categoria, procedimentos vinculados e faixa de preço.",
    whenToUse: "Quando o paciente não sabe o nome exato do procedimento.",
  },
  {
    name: "get_contact_journey",
    label: "Jornada do contato",
    category: "crm",
    description: "Etapa atual no CRM, eventos pendentes e próxima ação sugerida.",
    whenToUse: "Para orientar cadastro, agendamento, follow-up ou retomada contextual.",
  },
  {
    name: "resolve_quote_offer",
    label: "Resolver oferta de orçamento",
    category: "comercial",
    description: "Verifica se precisa perguntar médico, lista preços e validade.",
    whenToUse: "Antes de enviar orçamento quando o paciente pedir preço formal.",
  },
  {
    name: "create_and_send_quote",
    label: "Criar e enviar orçamento",
    category: "comercial",
    description: "Gera orçamento no sistema, PDF e resumo no WhatsApp.",
    whenToUse: "Após resolve_quote_offer sem necessidade de escolher médico.",
  },
  {
    name: "get_quote_status",
    label: "Status do orçamento",
    category: "comercial",
    description: "Consulta último orçamento enviado (enviado, expirado, etc.).",
    whenToUse: "Quando o paciente pergunta sobre proposta enviada.",
  },
  {
    name: "get_form_status",
    label: "Status do formulário",
    category: "formulario",
    description: "Lista formulários pendentes/respondidos das consultas futuras.",
    whenToUse: "Paciente pergunta se já preencheu. Envio automático: Configurações → Compliance.",
  },
  {
    name: "resend_form_link",
    label: "Reenviar formulário",
    category: "formulario",
    description: "Reenvia link quando o paciente pedir (não substitui cron de compliance).",
    whenToUse: "Somente a pedido do paciente.",
  },
  {
    name: "get_payment_status",
    label: "Status de pagamento",
    category: "financeiro",
    description: "Somente leitura — saldo pendente na comanda. Nunca registra pagamento.",
    whenToUse: "Paciente pergunta quanto deve; nunca aceitar 'já paguei' como confirmação.",
  },
  {
    name: "reschedule_appointment",
    label: "Remarcar consulta",
    category: "agendamento",
    description: "Altera data/hora de consulta agendada.",
    whenToUse: "Paciente pede remarcação com novo horário escolhido.",
  },
  {
    name: "collect_nps_feedback",
    label: "Coletar NPS",
    category: "crm",
    description: "Registra nota 0-10 e comentário pós-atendimento.",
    whenToUse: "Após consulta realizada, na pesquisa de satisfação.",
  },
  {
    name: "transfer_to_human",
    label: "Transferir para humano",
    category: "atendimento",
    description: "Encaminha a conversa para atendimento humano.",
    whenToUse:
      "Somente quando o paciente pedir explicitamente atendente humano ou houver reclamação grave — nunca durante agendamento.",
  },
];

export const ASSISTANT_TOOL_CATALOG_BY_CATEGORY = (
  Object.keys(ASSISTANT_TOOL_CATEGORY_LABELS) as AssistantToolCategory[]
).map((category) => ({
  category,
  label: ASSISTANT_TOOL_CATEGORY_LABELS[category],
  tools: ASSISTANT_TOOL_CATALOG.filter((t) => t.category === category),
}));
