import type { ContactJourney } from "@/lib/contact-journey/types";
import { CONTACT_INTENT_LABELS } from "@/lib/contact-journey/intents";
import { getStepDefinition } from "@/lib/contact-journey/steps";

export function buildContextualResumePrompt(journey: ContactJourney): string {
  const step = getStepDefinition(journey.currentStep);
  const intentLabel = CONTACT_INTENT_LABELS[journey.contactIntent];

  if (journey.contactIntent === "operacional" && journey.appointmentScheduledAt) {
    const date = new Date(journey.appointmentScheduledAt).toLocaleString("pt-BR");
    return `Cumprimente ${journey.displayName} e mencione a consulta de ${date}; pergunte se é sobre essa consulta ou outro assunto.`;
  }

  if (journey.contactIntent === "reativacao") {
    return `Cumprimente ${journey.displayName} e pergunte diretamente o que precisa — sem frases genéricas de reativação.`;
  }

  if (journey.contactIntent === "captacao" && journey.motivoProvavel === "preco") {
    return `Retome com ${journey.displayName} o assunto de valores da conversa anterior; pergunte se quer continuar.`;
  }

  if (journey.contactIntent === "captacao") {
    return `Retome com ${journey.displayName} a etapa "${step.label}" da conversa anterior; pergunte se quer continuar.`;
  }

  if (journey.contactIntent === "financeiro") {
    return `Pergunte a ${journey.displayName} se precisa de ajuda com pagamento ou comprovante.`;
  }

  if (journey.contactIntent === "pos_atendimento") {
    return `Pergunte a ${journey.displayName} como foi o atendimento — de forma direta, sem rodeios.`;
  }

  return `Atenda ${journey.displayName} conforme o contexto: ${intentLabel}, etapa "${step.label}".`;
}

export function formatJourneyContextForAi(journey: ContactJourney): string {
  const step = getStepDefinition(journey.currentStep);
  const lines = [
    `Contato: ${journey.displayName}`,
    `Tipo: ${journey.contactType === "lead" ? "contato/lead" : "paciente"}`,
    `Intenção: ${CONTACT_INTENT_LABELS[journey.contactIntent]}`,
    `Etapa: ${step.label} (${journey.phase})`,
    `Origem: ${journey.source}`,
  ];

  if (journey.motivoProvavel) {
    lines.push(`Motivo provável: ${journey.motivoProvavel} (confiança: ${journey.lossConfidence ?? "—"})`);
  }

  if (journey.appointmentScheduledAt) {
    lines.push(`Consulta: ${new Date(journey.appointmentScheduledAt).toLocaleString("pt-BR")} (${journey.appointmentStatus ?? "—"})`);
  }

  if (journey.suggestedAction) {
    lines.push(`Próxima ação: ${journey.suggestedAction.label}`);
  }

  lines.push(`Abertura sugerida: ${buildContextualResumePrompt(journey)}`);

  return lines.join("\n");
}
