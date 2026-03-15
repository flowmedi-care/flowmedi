export type TemplateMessageChannel = "email" | "whatsapp";

type VariableContext = "patient" | "clinic" | "appointment" | "form";
type VariableCategory = "Paciente" | "Consulta" | "Preparacao" | "Formulario" | "Clinica" | "Redes";

type VariableDefinition = {
  key: string;
  category: VariableCategory;
  requiredContexts: VariableContext[];
  // Optional means the field may be absent in DB config
  // and should warn (not block) when used.
  optional?: boolean;
};

const VARIABLE_DEFINITIONS: VariableDefinition[] = [
  // Paciente
  { key: "{{primeiro_nome_paciente}}", category: "Paciente", requiredContexts: ["patient"] },
  { key: "{{nome_paciente}}", category: "Paciente", requiredContexts: ["patient"] },
  { key: "{{email_paciente}}", category: "Paciente", requiredContexts: ["patient"], optional: true },
  { key: "{{telefone_paciente}}", category: "Paciente", requiredContexts: ["patient"], optional: true },
  { key: "{{data_nascimento}}", category: "Paciente", requiredContexts: ["patient"], optional: true },

  // Consulta
  { key: "{{data_consulta}}", category: "Consulta", requiredContexts: ["appointment"] },
  { key: "{{hora_consulta}}", category: "Consulta", requiredContexts: ["appointment"] },
  { key: "{{data_hora_consulta}}", category: "Consulta", requiredContexts: ["appointment"] },
  { key: "{{nome_medico}}", category: "Consulta", requiredContexts: ["appointment"], optional: true },
  { key: "{{tipo_consulta}}", category: "Consulta", requiredContexts: ["appointment"], optional: true },
  { key: "{{nome_procedimento}}", category: "Consulta", requiredContexts: ["appointment"], optional: true },
  { key: "{{status_consulta}}", category: "Consulta", requiredContexts: ["appointment"], optional: true },
  { key: "{{local_consulta}}", category: "Consulta", requiredContexts: ["appointment"], optional: true },

  // Preparacao
  { key: "{{recomendacoes}}", category: "Preparacao", requiredContexts: ["appointment"], optional: true },
  { key: "{{precisa_jejum}}", category: "Preparacao", requiredContexts: ["appointment"], optional: true },
  { key: "{{instrucoes_especiais}}", category: "Preparacao", requiredContexts: ["appointment"], optional: true },
  { key: "{{notas_preparo}}", category: "Preparacao", requiredContexts: ["appointment"], optional: true },
  { key: "{{preparo_completo}}", category: "Preparacao", requiredContexts: ["appointment"], optional: true },
  { key: "{{preparo_completo_html}}", category: "Preparacao", requiredContexts: ["appointment"], optional: true },

  // Formulario
  { key: "{{link_formulario}}", category: "Formulario", requiredContexts: ["form"] },
  { key: "{{nome_formulario}}", category: "Formulario", requiredContexts: ["form"], optional: true },
  { key: "{{prazo_formulario}}", category: "Formulario", requiredContexts: ["form"], optional: true },
  { key: "{{instrucao_formulario}}", category: "Formulario", requiredContexts: ["form"] },

  // Clinica
  { key: "{{nome_clinica}}", category: "Clinica", requiredContexts: ["clinic"] },
  { key: "{{telefone_clinica}}", category: "Clinica", requiredContexts: ["clinic"], optional: true },
  { key: "{{email_clinica}}", category: "Clinica", requiredContexts: ["clinic"], optional: true },
  { key: "{{endereco_clinica}}", category: "Clinica", requiredContexts: ["clinic"], optional: true },

  // Redes
  { key: "{{link_whatsapp_clinica}}", category: "Redes", requiredContexts: ["clinic"], optional: true },
  { key: "{{link_facebook_clinica}}", category: "Redes", requiredContexts: ["clinic"], optional: true },
  { key: "{{link_instagram_clinica}}", category: "Redes", requiredContexts: ["clinic"], optional: true },
];

const CATEGORY_ORDER: VariableCategory[] = [
  "Paciente",
  "Consulta",
  "Preparacao",
  "Formulario",
  "Clinica",
  "Redes",
];

const APPOINTMENT_EVENTS = new Set<string>([
  "appointment_created",
  "appointment_rescheduled",
  "appointment_confirmed",
  "appointment_not_confirmed",
  "appointment_reminder_30d",
  "appointment_reminder_15d",
  "appointment_reminder_7d",
  "appointment_reminder_48h",
  "appointment_reminder_24h",
  "appointment_reminder_2h",
  "appointment_canceled",
  "appointment_no_show",
  "appointment_completed",
  "return_appointment_reminder",
  "appointment_marked_as_return",
]);

const FORM_WITH_APPOINTMENT_EVENTS = new Set<string>([
  "form_linked",
  "form_link_sent",
  "form_reminder",
  "form_incomplete",
  "form_completed",
  "patient_form_completed",
]);

const FORM_ONLY_EVENTS = new Set<string>(["public_form_completed"]);
const PATIENT_ONLY_EVENTS = new Set<string>(["patient_registered"]);

function getEventContexts(eventCode: string): Set<VariableContext> {
  if (APPOINTMENT_EVENTS.has(eventCode)) {
    return new Set<VariableContext>(["patient", "clinic", "appointment"]);
  }
  if (FORM_WITH_APPOINTMENT_EVENTS.has(eventCode)) {
    return new Set<VariableContext>(["patient", "clinic", "appointment", "form"]);
  }
  if (FORM_ONLY_EVENTS.has(eventCode)) {
    return new Set<VariableContext>(["patient", "clinic", "form"]);
  }
  if (PATIENT_ONLY_EVENTS.has(eventCode)) {
    return new Set<VariableContext>(["patient", "clinic"]);
  }
  // Fallback conservador para evitar campos vazios inesperados
  return new Set<VariableContext>(["patient", "clinic"]);
}

function isVariableAllowedForContexts(
  definition: VariableDefinition,
  contexts: Set<VariableContext>
): boolean {
  return definition.requiredContexts.every((ctx) => contexts.has(ctx));
}

export const ALL_MESSAGE_TEMPLATE_VARIABLES = VARIABLE_DEFINITIONS.map((d) => d.key);

export function extractTemplateVariables(text: string): string[] {
  const matches = text.match(/\{\{[\w_]+\}\}/g) ?? [];
  return Array.from(new Set(matches));
}

export function getAllowedVariablesForEventChannel(
  eventCode: string,
  _channel: TemplateMessageChannel
): string[] {
  const contexts = getEventContexts(eventCode);
  return VARIABLE_DEFINITIONS.filter((definition) =>
    isVariableAllowedForContexts(definition, contexts)
  ).map((definition) => definition.key);
}

export function getVariableGroupsForEventChannel(
  eventCode: string,
  channel: TemplateMessageChannel
): Array<{ category: string; vars: string[] }> {
  const allowed = new Set(getAllowedVariablesForEventChannel(eventCode, channel));
  const grouped = new Map<VariableCategory, string[]>();

  for (const category of CATEGORY_ORDER) grouped.set(category, []);
  for (const variable of VARIABLE_DEFINITIONS) {
    if (!allowed.has(variable.key)) continue;
    grouped.get(variable.category)?.push(variable.key);
  }

  return CATEGORY_ORDER
    .map((category) => ({ category, vars: grouped.get(category) ?? [] }))
    .filter((group) => group.vars.length > 0);
}

export function getDisallowedVariablesForEventChannel(
  text: string,
  eventCode: string,
  channel: TemplateMessageChannel
): string[] {
  const used = extractTemplateVariables(text);
  const allowed = new Set(getAllowedVariablesForEventChannel(eventCode, channel));
  return used.filter((variable) => !allowed.has(variable));
}

export function getOptionalBlankRiskVariablesForEventChannel(
  usedVariables: string[],
  eventCode: string,
  channel: TemplateMessageChannel
): string[] {
  const allowed = new Set(getAllowedVariablesForEventChannel(eventCode, channel));
  const optional = new Set(
    VARIABLE_DEFINITIONS.filter((d) => d.optional).map((d) => d.key)
  );
  return usedVariables.filter((variable) => allowed.has(variable) && optional.has(variable));
}
