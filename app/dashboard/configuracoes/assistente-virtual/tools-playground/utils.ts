export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export type JsonSchemaProperty = {
  type?: string;
  description?: string;
  enum?: string[];
  items?: { type?: string };
};

export const MUTATING_TOOLS = new Set([
  "register_patient",
  "create_appointment",
  "confirm_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "create_and_send_quote",
  "resend_form_link",
  "collect_nps_feedback",
  "transfer_to_human",
]);

export const CHATBOT_TOOL_SET = new Set([
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
]);

export function buildArgsFromForm(
  properties: Record<string, JsonSchemaProperty>,
  formValues: Record<string, string>
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(properties)) {
    const raw = formValues[key]?.trim() ?? "";
    if (!raw && schema.type !== "boolean") continue;
    if (schema.type === "boolean") {
      args[key] = formValues[key] === "true";
      continue;
    }
    if (schema.type === "number") {
      const num = Number(raw);
      if (Number.isFinite(num)) args[key] = num;
      continue;
    }
    if (schema.type === "array") {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) args[key] = parsed;
      } catch {
        args[key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
      continue;
    }
    args[key] = raw;
  }
  return args;
}

export function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}
