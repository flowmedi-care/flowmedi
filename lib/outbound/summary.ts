export type LeadSummaryInput = {
  lead?: string;
  utm_source?: string;
  outbound_message?: string;
  elapsedSeconds: number;
  featuresOpened: string[];
  faqsOpened: string[];
  leadScore: number;
  interested: boolean;
  leadStatus?: string;
};

export type LeadSummary = {
  lead_label: string;
  origin_label: string;
  time_label: string;
  interests_label: string;
  score: number;
  interested: boolean;
  suggested_next_action: string;
  summary_text: string;
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${m}m`;
}

function suggestNextAction(input: LeadSummaryInput): string {
  if (input.interested && input.faqsOpened.some((q) => /whatsapp|integra/i.test(q))) {
    return "Fazer follow-up destacando a integração com WhatsApp.";
  }
  if (input.featuresOpened.includes("crm")) {
    return "Fazer follow-up destacando o CRM e o histórico de pacientes.";
  }
  if (input.featuresOpened.includes("agenda")) {
    return "Fazer follow-up destacando a agenda automática.";
  }
  if (input.leadScore >= 40) {
    return "Fazer follow-up perguntando se ficou alguma dúvida sobre a demonstração.";
  }
  if (input.leadScore >= 15) {
    return "Reenviar o link com um ângulo diferente (copy B) ou reforçar o valor da agenda.";
  }
  return "Aguardar ou enviar um lembrete leve — engajamento ainda baixo.";
}

export function buildLeadSummary(input: LeadSummaryInput): LeadSummary {
  const lead_label = input.lead || "anon";
  const originParts = [
    input.utm_source ? capitalize(input.utm_source) : "Direto",
    input.outbound_message ? `(mensagem ${input.outbound_message})` : null,
  ].filter(Boolean);
  const origin_label = originParts.join(" ");

  const interests = [
    ...input.featuresOpened.map((f) => f.toUpperCase()),
    ...input.faqsOpened.slice(0, 2).map((q) => `FAQ: ${q}`),
  ];
  const interests_label =
    interests.length > 0 ? interests.join(", ") : "Nenhum interesse específico";

  const time_label = formatTime(input.elapsedSeconds);
  const suggested_next_action = suggestNextAction(input);

  const summary_text = [
    `Lead: ${lead_label}`,
    `Origem: ${origin_label}`,
    `Tempo na página: ${time_label}`,
    `Interesse demonstrado: ${interests_label}`,
    `Score: ${input.leadScore}/100`,
    input.interested ? "Interested: true" : "Interested: false",
    `Próxima ação sugerida: ${suggested_next_action}`,
  ].join("\n");

  return {
    lead_label,
    origin_label,
    time_label,
    interests_label,
    score: input.leadScore,
    interested: input.interested,
    suggested_next_action,
    summary_text,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
