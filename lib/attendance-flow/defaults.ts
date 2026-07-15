import type {
  AppointmentPolicy,
  AppointmentPolicyInput,
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

export const DEFAULT_CHECK_IN_POLICY = {
  enabled: false,
  window: {
    opens_before_hours: 2,
    closes_after_minutes: 30,
  },
} as const;

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
    reschedule_booking: "required",
    check_in: "required",
  },
  check_in: { ...DEFAULT_CHECK_IN_POLICY, window: { ...DEFAULT_CHECK_IN_POLICY.window } },
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
    requiredStage: "before_booking",
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
    requiredStage: "after_booking",
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
    requiredStage: "before_booking",
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
    completion: { type: "patient_or_collected", key: "insurance", patientKey: "insurance" },
    allowed_tools: ["update_patient_intake", "get_service_price"],
    prompt_hint: "Pergunte qual convênio ou se é particular.",
    priority: 30,
    default_policy: "optional",
    requiredStage: "before_booking",
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
    requiredStage: "after_booking",
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
    prompt_hint: "Liste as consultas do paciente e identifique qual.",
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
  {
    id: "reschedule_booking",
    label: "Remarcação realizada",
    phase_id: "remarcacao",
    completion: { type: "mutation", key: "reschedule_booking" },
    allowed_tools: ["reschedule_appointment"],
    prompt_hint: "Confirme o novo horário e remarque a consulta selecionada.",
    priority: 10,
    default_policy: "required",
    requires_confirmation: true,
    is_mutation: true,
  },
  {
    id: "check_in",
    label: "Check-in realizado",
    phase_id: "check_in",
    completion: { type: "mutation", key: "check_in" },
    allowed_tools: ["perform_check_in"],
    prompt_hint: "Confirme e registre o check-in da consulta selecionada.",
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

const RESCHEDULE_PHASES = [
  {
    id: "remarcacao",
    label: "Remarcação",
    goal_ids: ["appointment_selected", "slot_selected", "reschedule_booking"],
  },
];

const CHECK_IN_PHASES = [
  {
    id: "check_in",
    label: "Check-in",
    goal_ids: ["appointment_selected", "check_in"],
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
  runtime: {
    resetSpec: {
      mutationKeys: ["create_booking"],
      collectedKeys: [],
    },
  },
};

export const DEFAULT_WORKFLOW_CANCELAMENTO: WorkflowDefinition = {
  id: "cancelamento",
  label: "Cancelamento",
  mode: "assisted",
  goal_ids: ["appointment_selected", "cancel_reason", "cancel_booking"],
  phases: CANCEL_PHASES,
  enabled: true,
  runtime: {
    resetSpec: {
      mutationKeys: ["cancel_booking"],
      collectedKeys: ["cancel_reason", "custom:cancel_reason"],
    },
  },
};

export const DEFAULT_WORKFLOW_REMARCACAO: WorkflowDefinition = {
  id: "reschedule",
  label: "Remarcação",
  mode: "assisted",
  goal_ids: ["appointment_selected", "slot_selected", "reschedule_booking"],
  phases: RESCHEDULE_PHASES,
  enabled: true,
  runtime: {
    resetSpec: {
      mutationKeys: ["reschedule_booking"],
      collectedKeys: [],
    },
  },
};

export const DEFAULT_WORKFLOW_CHECK_IN: WorkflowDefinition = {
  id: "check_in",
  label: "Check-in",
  mode: "assisted",
  goal_ids: ["appointment_selected", "check_in"],
  phases: CHECK_IN_PHASES,
  enabled: true,
  runtime: {
    resetSpec: {
      mutationKeys: ["check_in"],
      collectedKeys: [],
    },
  },
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
    reschedule: DEFAULT_WORKFLOW_REMARCACAO,
    check_in: DEFAULT_WORKFLOW_CHECK_IN,
    ...Object.fromEntries(SCAFFOLD_WORKFLOWS.map((w) => [w.id, w])),
  },
};

export function mergeAppointmentPolicy(
  stored: AppointmentPolicyInput | null | undefined
): AppointmentPolicy {
  const storedCheckIn = stored?.check_in;
  return {
    goals: {
      ...DEFAULT_APPOINTMENT_POLICY.goals,
      ...(stored?.goals ?? {}),
    },
    check_in: {
      enabled: storedCheckIn?.enabled ?? DEFAULT_CHECK_IN_POLICY.enabled,
      window: {
        opens_before_hours:
          storedCheckIn?.window?.opens_before_hours ??
          DEFAULT_CHECK_IN_POLICY.window.opens_before_hours,
        closes_after_minutes:
          storedCheckIn?.window?.closes_after_minutes ??
          DEFAULT_CHECK_IN_POLICY.window.closes_after_minutes,
      },
    },
  };
}

export function mergeConversationFlows(
  stored: Partial<ConversationFlowsConfig> | null | undefined
): ConversationFlowsConfig {
  const defaults = DEFAULT_CONVERSATION_FLOWS.workflows;
  const storedWorkflows = stored?.workflows ?? {};
  const merged: Record<string, WorkflowDefinition> = { ...defaults };

  /** First-class mutation workflows: stored must not destroy structural goals/runtime. */
  const STRUCTURAL_PIN = new Set(["cancelamento", "reschedule", "check_in"]);

  for (const [id, wf] of Object.entries(storedWorkflows)) {
    const base = defaults[id];
    if (base && STRUCTURAL_PIN.has(id)) {
      merged[id] = {
        ...base,
        ...wf,
        id,
        goal_ids: base.goal_ids,
        phases: base.phases,
        enabled: base.enabled,
        runtime: base.runtime,
      };
      continue;
    }
    merged[id] = { ...base, ...wf, id };
  }
  return { workflows: merged };
}
