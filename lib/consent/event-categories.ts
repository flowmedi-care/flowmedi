/** Eventos de mensagem que não exigem consentimento de marketing (transacionais). */

export const TRANSACTIONAL_EVENT_CODES = new Set([
  "appointment_created",
  "appointment_rescheduled",
  "appointment_canceled",
  "appointment_confirmed",
  "appointment_not_confirmed",
  "appointment_reminder_30d",
  "appointment_reminder_15d",
  "appointment_reminder_7d",
  "appointment_reminder_48h",
  "appointment_reminder_24h",
  "appointment_reminder_2h",
  "form_link_sent",
  "form_reminder",
  "form_completed",
  "form_incomplete",
  "form_linked",
  "public_form_completed",
  "appointment_completed",
  "appointment_no_show",
  "return_appointment_reminder",
  "appointment_marked_as_return",
]);

/** Eventos que podem ser considerados marketing e sujeitos a consentimento. */
export const MARKETING_LIKE_EVENT_CODES = new Set([
  "patient_registered",
  "patient_nps",
  "promotional",
  "newsletter",
]);

export function isTransactionalMessageEvent(eventCode: string): boolean {
  if (TRANSACTIONAL_EVENT_CODES.has(eventCode)) return true;
  if (MARKETING_LIKE_EVENT_CODES.has(eventCode)) return false;
  // Categorias desconhecidas: exigir consentimento se clínica configurou bloqueio
  return eventCode.includes("reminder") || eventCode.includes("appointment") || eventCode.includes("form");
}

export function consentPurposeForEvent(eventCode: string): "marketing" | "communications" {
  return MARKETING_LIKE_EVENT_CODES.has(eventCode) ? "marketing" : "communications";
}
