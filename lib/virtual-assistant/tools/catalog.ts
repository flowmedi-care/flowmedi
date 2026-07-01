export type AssistantToolCategory =
  | "paciente"
  | "agendamento"
  | "precos"
  | "crm"
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
  crm: "Jornada do cliente (CRM)",
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
    description: "Busca horários disponíveis para médico + procedimento.",
    whenToUse: "Depois que médico e procedimento estão definidos.",
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
    name: "transfer_to_human",
    label: "Transferir para humano",
    category: "atendimento",
    description: "Encaminha a conversa para atendimento humano.",
    whenToUse: "Reclamação, pedido explícito ou situação fora do escopo do bot.",
  },
];

export const ASSISTANT_TOOL_CATALOG_BY_CATEGORY = (
  Object.keys(ASSISTANT_TOOL_CATEGORY_LABELS) as AssistantToolCategory[]
).map((category) => ({
  category,
  label: ASSISTANT_TOOL_CATEGORY_LABELS[category],
  tools: ASSISTANT_TOOL_CATALOG.filter((t) => t.category === category),
}));
