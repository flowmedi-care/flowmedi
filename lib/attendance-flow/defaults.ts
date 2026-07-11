import type {
  AppointmentPolicy,
  ConversationFlowsConfig,
  GoalDefinition,
  WorkflowDefinition,
} from "./types";

export const BOOKING_CORE_GOAL_IDS = [
  "patient_identified",
  "doctor_selected",
  "procedure_selected",
  "slot_selected",
] as const;

export const DEFAULT_APPOINTMENT_POLICY: AppointmentPolicy = {
  goals: {
    patient_identified: "required",
    doctor_selected: "required",
    procedure_selected: "required",
    slot_selected: "required",
    insurance: "optional",
    payment_method: "optional",
    cpf: "optional",
    email: "optional",
    guardian: "optional",
    booking_created: "required",
    appointment_selected: "required",
    cancel_reason: "optional",
    cancel_booking: "required",
  },
};

export const BUILTIN_GOAL_DEFINITIONS: GoalDefinition[] = [
  {
    id: "patient_identified",
    label: "Paciente identificado",
    phase_id: "cadastro",
    completion: { type: "state_path", path: "patient_id" },
    allowed_tools: ["lookup_patient_by_phone", "register_patient"],
    prompt_hint: "Identifique o paciente pelo telefone ou cadastre com nome completo.",
    priority: 100,
    default_policy: "required",
  },
  {
    id: "cpf",
    label: "CPF",
    phase_id: "cadastro",
    completion: { type: "patient_or_collected", key: "cpf", patientKey: "cpf" },
    allowed_tools: ["update_patient_intake"],
    prompt_hint: "Colete o CPF do paciente.",
    priority: 95,
    default_policy: "optional",
  },
  {
    id: "email",
    label: "E-mail",
    phase_id: "cadastro",
    completion: { type: "patient_or_collected", key: "email", patientKey: "email" },
    allowed_tools: ["update_patient_intake", "register_patient"],
    prompt_hint: "Colete o e-mail do paciente (opcional se não quiser informar).",
    priority: 92,
    default_policy: "optional",
  },
  {
    id: "guardian",
    label: "Responsável",
    phase_id: "cadastro",
    completion: { type: "collected", key: "guardian" },
    when: [{ field: "patient.age", operator: "lt", value: 18 }],
    allowed_tools: ["update_patient_intake"],
    prompt_hint: "Paciente menor de idade — colete nome do responsável.",
    priority: 94,
    default_policy: "optional",
  },
  {
    id: "doctor_selected",
    label: "Médico selecionado",
    phase_id: "consulta",
    completion: { type: "state_path", path: "booking.doctor_id" },
    allowed_tools: ["list_doctors"],
    prompt_hint: "Ajude o paciente a escolher o médico.",
    priority: 90,
    default_policy: "required",
  },
  {
    id: "procedure_selected",
    label: "Procedimento selecionado",
    phase_id: "consulta",
    completion: { type: "state_path", path: "booking.procedure_id" },
    allowed_tools: ["list_procedures"],
    prompt_hint: "Ajude o paciente a escolher o procedimento ou tipo de consulta.",
    priority: 85,
    default_policy: "required",
  },
  {
    id: "slot_selected",
    label: "Horário selecionado",
    phase_id: "consulta",
    completion: { type: "custom", resolver: "slot_selected" },
    allowed_tools: ["find_available_slots"],
    prompt_hint: "Busque dias/horários disponíveis e aguarde o paciente escolher.",
    priority: 80,
    default_policy: "required",
  },
  {
    id: "insurance",
    label: "Convênio",
    phase_id: "financeiro",
    completion: { type: "collected", key: "insurance" },
    allowed_tools: ["update_patient_intake", "get_service_price"],
    prompt_hint: "Pergunte qual convênio ou se é particular.",
    priority: 30,
    default_policy: "optional",
  },
  {
    id: "payment_method",
    label: "Forma de pagamento",
    phase_id: "financeiro",
    completion: { type: "collected", key: "payment_method" },
    when: [{ field: "collected.insurance", operator: "eq", value: "particular" }],
    allowed_tools: ["update_patient_intake"],
    prompt_hint: "Pergunte a forma de pagamento preferida.",
    priority: 25,
    default_policy: "optional",
  },
  {
    id: "booking_created",
    label: "Agendamento criado",
    phase_id: "confirmacao",
    completion: { type: "mutation", key: "create_booking" },
    allowed_tools: ["create_appointment"],
    prompt_hint: "Confirme os dados e crie o agendamento.",
    priority: 10,
    default_policy: "required",
    requires_confirmation: true,
    is_mutation: true,
  },
  {
    id: "appointment_selected",
    label: "Consulta selecionada",
    phase_id: "cancelamento",
    completion: { type: "state_path", path: "focused_appointment_id" },
    allowed_tools: ["list_patient_appointments"],
    prompt_hint: "Liste as consultas do paciente e identifique qual cancelar.",
    priority: 100,
    default_policy: "required",
  },
  {
    id: "cancel_reason",
    label: "Motivo do cancelamento",
    phase_id: "cancelamento",
    completion: { type: "collected", key: "cancel_reason" },
    allowed_tools: ["update_patient_intake"],
    prompt_hint: "Pergunte o motivo do cancelamento (opcional).",
    priority: 50,
    default_policy: "optional",
  },
  {
    id: "cancel_booking",
    label: "Cancelamento realizado",
    phase_id: "cancelamento",
    completion: { type: "mutation", key: "cancel_booking" },
    allowed_tools: ["cancel_appointment"],
    prompt_hint: "Confirme e cancele a consulta selecionada.",
    priority: 10,
    default_policy: "required",
    requires_confirmation: true,
    is_mutation: true,
  },
];

const BOOKING_PHASES = [
  {
    id: "cadastro",
    label: "Cadastro",
    goal_ids: ["patient_identified", "cpf", "email", "guardian"],
  },
  {
    id: "consulta",
    label: "Consulta",
    goal_ids: ["doctor_selected", "procedure_selected", "slot_selected"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    goal_ids: ["insurance", "payment_method"],
  },
  {
    id: "confirmacao",
    label: "Confirmação",
    goal_ids: ["booking_created"],
  },
];

const CANCEL_PHASES = [
  {
    id: "cancelamento",
    label: "Cancelamento",
    goal_ids: ["appointment_selected", "cancel_reason", "cancel_booking"],
  },
];

export const DEFAULT_WORKFLOW_CONSULTA: WorkflowDefinition = {
  id: "consulta",
  label: "Consulta",
  mode: "assisted",
  goal_ids: [
    "patient_identified",
    "cpf",
    "email",
    "doctor_selected",
    "procedure_selected",
    "slot_selected",
    "insurance",
    "payment_method",
    "booking_created",
  ],
  phases: BOOKING_PHASES,
  enabled: true,
};

export const DEFAULT_WORKFLOW_CANCELAMENTO: WorkflowDefinition = {
  id: "cancelamento",
  label: "Cancelamento",
  mode: "assisted",
  goal_ids: ["appointment_selected", "cancel_reason", "cancel_booking"],
  phases: CANCEL_PHASES,
  enabled: true,
};

export const SCAFFOLD_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "exame",
    label: "Exame",
    mode: "strict",
    goal_ids: DEFAULT_WORKFLOW_CONSULTA.goal_ids,
    phases: BOOKING_PHASES,
    enabled: false,
  },
  {
    id: "teleconsulta",
    label: "Teleconsulta",
    mode: "express",
    goal_ids: [
      "patient_identified",
      "doctor_selected",
      "procedure_selected",
      "slot_selected",
      "booking_created",
    ],
    phases: BOOKING_PHASES.filter((p) => p.id !== "financeiro"),
    enabled: false,
  },
  {
    id: "reschedule",
    label: "Remarcação",
    mode: "assisted",
    goal_ids: ["appointment_selected", "slot_selected", "booking_created"],
    phases: [],
    enabled: false,
  },
  {
    id: "quotation",
    label: "Orçamento",
    mode: "assisted",
    goal_ids: ["patient_identified", "procedure_selected", "insurance"],
    phases: [],
    enabled: false,
  },
];

export const DEFAULT_CONVERSATION_FLOWS: ConversationFlowsConfig = {
  workflows: {
    consulta: DEFAULT_WORKFLOW_CONSULTA,
    cancelamento: DEFAULT_WORKFLOW_CANCELAMENTO,
    ...Object.fromEntries(SCAFFOLD_WORKFLOWS.map((w) => [w.id, w])),
  },
};

export function mergeAppointmentPolicy(
  stored: Partial<AppointmentPolicy> | null | undefined
): AppointmentPolicy {
  return {
    goals: {
      ...DEFAULT_APPOINTMENT_POLICY.goals,
      ...(stored?.goals ?? {}),
    },
  };
}

export function mergeConversationFlows(
  stored: Partial<ConversationFlowsConfig> | null | undefined
): ConversationFlowsConfig {
  const defaults = DEFAULT_CONVERSATION_FLOWS.workflows;
  const storedWorkflows = stored?.workflows ?? {};
  const merged: Record<string, WorkflowDefinition> = { ...defaults };
  for (const [id, wf] of Object.entries(storedWorkflows)) {
    merged[id] = { ...defaults[id], ...wf, id };
  }
  return { workflows: merged };
}
