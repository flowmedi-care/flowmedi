/**
 * Contato (pipeline) vs Paciente oficial.
 * Paciente completo = pelo menos uma consulta realizada (promoção pós-atendimento).
 */
export type ContactDisplayStatus = "contato" | "contato_agendado" | "paciente";

export function resolveContactDisplayStatus(input: {
  contactType: "lead" | "patient";
  hasCompletedAppointment: boolean;
  hasFutureAppointment: boolean;
}): ContactDisplayStatus {
  if (input.hasCompletedAppointment) return "paciente";
  if (input.hasFutureAppointment || input.contactType === "patient") return "contato_agendado";
  return "contato";
}

export const CONTACT_DISPLAY_LABELS: Record<ContactDisplayStatus, string> = {
  contato: "Contato",
  contato_agendado: "Contato agendado",
  paciente: "Paciente",
};
