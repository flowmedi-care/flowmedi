import type { ContactJourney } from "@/lib/contact-journey/types";
import { CONTACT_INTENT_LABELS } from "@/lib/contact-journey/intents";
import { getStepDefinition } from "@/lib/contact-journey/steps";

export function buildContextualResumePrompt(journey: ContactJourney): string {
  const step = getStepDefinition(journey.currentStep);
  const intentLabel = CONTACT_INTENT_LABELS[journey.contactIntent];

  if (journey.contactIntent === "operacional" && journey.appointmentScheduledAt) {
    const date = new Date(journey.appointmentScheduledAt).toLocaleString("pt-BR");
    return `Olá ${journey.displayName}, vi que você tem uma consulta marcada para ${date}. Quer falar sobre isso ou outro assunto?`;
  }

  if (journey.contactIntent === "reativacao") {
    return `Olá ${journey.displayName}, faz um tempo que não nos vemos! Como podemos ajudar você hoje?`;
  }

  if (journey.contactIntent === "captacao" && journey.motivoProvavel === "preco") {
    return `Olá ${journey.displayName}, na nossa última conversa estávamos falando de valores. Gostaria de retomar?`;
  }

  if (journey.contactIntent === "captacao") {
    return `Olá ${journey.displayName}, vimos que na última conversa estávamos em "${step.label}". Quer continuar de onde paramos?`;
  }

  if (journey.contactIntent === "financeiro") {
    return `Olá ${journey.displayName}, posso ajudar com questões de pagamento ou comprovante?`;
  }

  if (journey.contactIntent === "pos_atendimento") {
    return `Olá ${journey.displayName}, gostaríamos de saber como foi sua experiência conosco. Pode nos contar?`;
  }

  return `Olá ${journey.displayName}, como posso ajudar? (Contexto: ${intentLabel} — ${step.label})`;
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
