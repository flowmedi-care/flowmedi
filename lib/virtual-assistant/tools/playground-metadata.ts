export type PlaygroundEntityType =
  | "patient"
  | "doctor"
  | "procedure"
  | "appointment"
  | "service"
  | "room"
  | "dimension_values";

export type PlaygroundWidgetType =
  | "entity"
  | "datetime-iso"
  | "date"
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "array";

export type PlaygroundParamMeta = {
  label: string;
  description: string;
  example?: string;
  widget?: PlaygroundWidgetType;
  entity?: PlaygroundEntityType;
  inferFrom?: string[];
};

const ENTITY_SUFFIX_MAP: Record<string, PlaygroundEntityType> = {
  patient_id: "patient",
  doctor_id: "doctor",
  procedure_id: "procedure",
  appointment_id: "appointment",
  service_id: "service",
  room_id: "room",
  focused_appointment_id: "appointment",
  pending_confirmation_appointment_id: "appointment",
  pending_reschedule_appointment_id: "appointment",
  last_created_appointment_id: "appointment",
};

const PARAM_OVERRIDES: Record<string, PlaygroundParamMeta> = {
  patient_id: {
    label: "Paciente",
    entity: "patient",
    description: "Paciente já cadastrado na clínica.",
    example: "Selecione pelo nome — o UUID é preenchido automaticamente.",
    inferFrom: ["phone", "aiState.patient_id"],
  },
  doctor_id: {
    label: "Médico",
    entity: "doctor",
    description: "Profissional que realizará a consulta ou procedimento.",
    example: "Selecione o médico na lista.",
    inferFrom: ["aiState.booking.doctor_id", "aiState.doctor_id"],
  },
  procedure_id: {
    label: "Procedimento",
    entity: "procedure",
    description: "Procedimento ou consulta a ser agendada.",
    example: "Selecione o procedimento na lista.",
    inferFrom: ["aiState.booking.procedure_id", "aiState.procedure_id"],
  },
  appointment_id: {
    label: "Consulta",
    entity: "appointment",
    description: "Consulta existente do paciente.",
    example: "Selecione uma consulta futura do paciente.",
    inferFrom: ["aiState.focused_appointment_id", "context.appointments"],
  },
  service_id: {
    label: "Serviço",
    entity: "service",
    description: "Serviço da clínica (alternativa a procedimento para preços).",
    example: "Selecione o serviço na lista.",
    inferFrom: ["aiState.service_id"],
  },
  room_id: {
    label: "Sala",
    entity: "room",
    description: "Sala onde ocorrerá a consulta.",
    example: "Selecione a sala disponível.",
  },
  scheduled_at: {
    label: "Data e horário",
    widget: "datetime-iso",
    description: "Data e horário da consulta no formato ISO 8601.",
    example: "2026-08-15T14:30:00-03:00",
    inferFrom: ["aiState.booking.pending_slot", "aiState.booking.offered_slots"],
  },
  new_scheduled_at: {
    label: "Novo horário",
    widget: "datetime-iso",
    description: "Novo horário para remarcação no formato ISO 8601.",
    example: "2026-08-20T10:00:00-03:00",
    inferFrom: ["aiState.booking.pending_slot"],
  },
  date: {
    label: "Data",
    widget: "date",
    description: "Data escolhida pelo paciente.",
    example: "2026-08-15",
    inferFrom: ["aiState.booking.date"],
  },
  dimension_value_ids: {
    label: "Convênio / dimensões",
    widget: "array",
    entity: "dimension_values",
    description: "Valores de dimensão de preço (convênio, turno, etc.).",
    example: "Selecione convênio ou turno quando aplicável.",
  },
  full_name: {
    label: "Nome completo",
    widget: "text",
    description: "Nome completo informado pelo paciente.",
    example: "João da Silva",
  },
  email: {
    label: "E-mail",
    widget: "text",
    description: "E-mail opcional do paciente.",
    example: "joao@email.com",
  },
  days_ahead: {
    label: "Dias à frente",
    widget: "number",
    description: "Quantos dias à frente buscar horários disponíveis.",
    example: "14",
  },
  skip_days: {
    label: "Pular dias",
    widget: "number",
    description: "Pular N dias já oferecidos quando o paciente pede outras opções.",
    example: "3",
  },
  period: {
    label: "Turno",
    widget: "enum",
    description: "Turno preferido: manhã ou tarde.",
    example: "manha",
  },
  include_past: {
    label: "Incluir passadas",
    widget: "boolean",
    description: "Se true, inclui consultas passadas na listagem.",
    example: "false",
  },
  cancellation_reason: {
    label: "Motivo do cancelamento",
    widget: "enum",
    description: "reschedule = quer remarcar; dropped = desistiu; other = cancelamento genérico.",
    example: "reschedule",
  },
  score: {
    label: "Nota NPS",
    widget: "number",
    description: "Nota de satisfação de 0 a 10.",
    example: "9",
  },
  comment: {
    label: "Comentário",
    widget: "text",
    description: "Comentário opcional do paciente sobre o atendimento.",
    example: "Atendimento excelente.",
  },
  reason: {
    label: "Motivo",
    widget: "text",
    description: "Motivo objetivo da transferência ou ação.",
    example: "Paciente pediu atendente humano.",
  },
  query: {
    label: "Pergunta",
    widget: "text",
    description: "Pergunta ou tema para buscar na FAQ.",
    example: "Qual o horário de funcionamento?",
  },
  journey_step: {
    label: "Etapa CRM",
    widget: "text",
    description: "Etapa atual da jornada do contato (opcional).",
    example: "aguardando_agendamento",
  },
};

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\bid\b/gi, "ID")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPlaygroundParamMeta(
  paramName: string,
  schemaDescription?: string
): PlaygroundParamMeta {
  const override = PARAM_OVERRIDES[paramName];
  if (override) {
    return {
      ...override,
      description: schemaDescription || override.description,
    };
  }

  const entity = ENTITY_SUFFIX_MAP[paramName];
  if (entity) {
    return {
      label: humanizeKey(paramName.replace(/_id$/, "")),
      entity,
      widget: "entity",
      description: schemaDescription || `Selecione ${humanizeKey(paramName.replace(/_id$/, "")).toLowerCase()}.`,
      inferFrom: [`aiState.${paramName}`],
    };
  }

  return {
    label: humanizeKey(paramName),
    widget: "text",
    description: schemaDescription || "",
  };
}

export type AiStateSectionMeta = {
  id: string;
  label: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "enum" | "json" | "entity";
    entity?: PlaygroundEntityType;
    enumValues?: string[];
    description?: string;
    nested?: boolean;
  }>;
};

export const AI_STATE_SECTIONS: AiStateSectionMeta[] = [
  {
    id: "patient",
    label: "Paciente",
    description: "Identificação do paciente vinculado à conversa.",
    fields: [
      {
        key: "patient_id",
        label: "Paciente",
        type: "entity",
        entity: "patient",
        description: "UUID do paciente encontrado ou cadastrado.",
      },
    ],
  },
  {
    id: "booking",
    label: "Agendamento (booking)",
    description: "Estado do fluxo de agendamento em andamento.",
    fields: [
      { key: "booking.procedure_id", label: "Procedimento", type: "entity", entity: "procedure" },
      { key: "booking.doctor_id", label: "Médico", type: "entity", entity: "doctor" },
      { key: "booking.date", label: "Data escolhida", type: "string", description: "YYYY-MM-DD" },
      { key: "booking.pending_slot", label: "Horário pendente", type: "string", description: "ISO 8601" },
      {
        key: "booking.status",
        label: "Status",
        type: "enum",
        enumValues: ["collecting", "confirming", "done"],
      },
      {
        key: "booking.offered_slots",
        label: "Horários oferecidos",
        type: "json",
        description: "Array de { scheduled_at, display }",
      },
    ],
  },
  {
    id: "offered",
    label: "Opções oferecidas",
    description: "Listas numeradas apresentadas ao paciente para escolha.",
    fields: [
      { key: "offered_doctors", label: "Médicos oferecidos", type: "json" },
      { key: "offered_procedures", label: "Procedimentos oferecidos", type: "json" },
      { key: "offered_days", label: "Dias oferecidos", type: "json" },
    ],
  },
  {
    id: "appointments",
    label: "Consultas",
    description: "Consultas em foco ou ativas na conversa.",
    fields: [
      {
        key: "focused_appointment_id",
        label: "Consulta em foco",
        type: "entity",
        entity: "appointment",
      },
      { key: "active_appointments", label: "Consultas ativas", type: "json" },
    ],
  },
  {
    id: "legacy",
    label: "Legado (VA)",
    description: "Campos legados do assistente virtual — mantidos para compatibilidade.",
    fields: [
      {
        key: "booking_step",
        label: "Etapa do booking",
        type: "enum",
        enumValues: ["procedure", "doctor", "day", "slot", "patient", "confirm", "done"],
      },
      { key: "doctor_id", label: "Médico (legado)", type: "entity", entity: "doctor" },
      { key: "procedure_id", label: "Procedimento (legado)", type: "entity", entity: "procedure" },
      { key: "service_id", label: "Serviço (legado)", type: "entity", entity: "service" },
      { key: "pending_slot", label: "Slot pendente (legado)", type: "string" },
      { key: "offered_slots", label: "Slots oferecidos (legado)", type: "json" },
      { key: "offered_days", label: "Dias oferecidos (legado)", type: "json" },
      { key: "journey_step_code", label: "Etapa CRM", type: "string" },
      { key: "last_created_appointment_id", label: "Última consulta criada", type: "entity", entity: "appointment" },
      { key: "dimension_value_ids", label: "Dimensões de preço", type: "json" },
    ],
  },
  {
    id: "infra",
    label: "Infraestrutura",
    description: "Campos internos de controle — raramente editados manualmente.",
    fields: [
      { key: "consecutive_tool_failures", label: "Falhas consecutivas", type: "number" },
      { key: "handoff_reason", label: "Motivo handoff", type: "string" },
      { key: "bot_loop_detected_at", label: "Loop detectado em", type: "string" },
    ],
  },
];

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split(".");
  const next = { ...obj };
  if (parts.length === 1) {
    if (value === undefined || value === "") {
      delete next[parts[0]!];
    } else {
      next[parts[0]!] = value;
    }
    return next;
  }
  const [head, ...rest] = parts;
  const child = (next[head!] as Record<string, unknown>) ?? {};
  next[head!] = setNestedValue(child, rest.join("."), value);
  return next;
}
