import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { NormalizedFacts } from "../extractors/types";
import type { FaqItem } from "../tools/types";
import type { AiState } from "../state/types";
import { formatChatbotAiStateForPrompt } from "../state/format-for-prompt";

export type ClinicContext = {
  clinicName: string;
  assistantName: string;
  tone: string;
  useEmojis: boolean;
  hoursText?: string;
  address?: string;
  /** ACL-filtered facts from Information Sources (Prompt Builder output) */
  knowledgePackageText?: string;
  faqs: FaqItem[];
  settings: Partial<VirtualAssistantSettings>;
  aiState?: AiState;
  facts?: NormalizedFacts;
  flowBlock?: string;
  /** Bloco do OperationsSnapshot — única fonte do responsável/decisão */
  opsBlock?: string;
};

export function formatContextForPrompt(
  facts: NormalizedFacts | undefined,
  aiState: AiState | undefined
): string {
  const lines: string[] = [];
  if (facts && Object.keys(facts).length > 0) {
    lines.push("Fatos extraídos da mensagem atual (determinísticos):");
    if (facts.date) lines.push(`- Data mencionada: ${facts.date}`);
    if (facts.period) lines.push(`- Turno mencionado: ${facts.period}`);
    if (facts.selectedIndex != null) {
      lines.push(`- Seleção numérica: ${facts.selectedIndex} (use offered_* ou options para obter id)`);
    }
    if (facts.confirmed === true) lines.push("- Paciente confirmou (sim/isso)");
    if (facts.confirmed === false) lines.push("- Paciente negou");
    if (facts.ordinal != null) {
      lines.push(`- Ordinal/primeiro: ${facts.ordinal} (ex: "qualquer um" → escolha opção ${facts.ordinal})`);
    }
  }
  if (aiState) {
    const stateBlock = formatChatbotAiStateForPrompt(aiState);
    if (stateBlock) {
      lines.push("", "Contexto da conversa:", stateBlock);
    }
  }
  return lines.join("\n");
}

export function buildSystemPrompt(ctx: ClinicContext): string {
  const emojiPolicy = ctx.useEmojis
    ? "Pode usar emojis com moderação."
    : "Não use emojis.";

  const lines = [
    `Você é ${ctx.assistantName} da ${ctx.clinicName}, atendendo pacientes via WhatsApp.`,
    "",
  ];

  if (ctx.opsBlock?.trim()) {
    lines.push(ctx.opsBlock.trim(), "");
  }

  lines.push(
    "Regras:",
    "- Use ferramentas para obter dados da clínica. Nunca invente preços, horários, procedimentos ou consultas.",
    '- Interprete retornos: "success" (dados), "needs_input" (pergunte o que falta ou apresente options), "unavailable" (explique e sugira alternativa), "not_found" (entidade não existe), "error" (explique sem insistir).',
    "- Consultas existentes: chame list_patient_appointments. Resultados estruturados (lista) são autoritativos — não invente, omita nem resuma consultas que a tool retornou.",
    "- Confirme com o paciente antes de create_appointment, cancel_appointment, reschedule_appointment ou perform_check_in.",
    "- Nunca mostre datas/horários em ISO (ex.: 2026-07-17T13:00:00.000Z) ao paciente — use dia da semana, data e hora em português.",
    "- SELEÇÃO: nunca afirme que o paciente escolheu médico, procedimento, data, horário ou consulta se o contexto/estado não mostrar essa seleção (ex.: pending_slot para horário). Sem pending_slot, NÃO diga \"Você escolheu…\" — peça o número ou o horário da lista estruturada.",
    "- Listas de horários vindas da tool (slot_list) são autoritativas — use exatamente os displays numerados; não reescreva nem converta fuso.",
    "- Ordem do agendamento NOVO: médico → procedimento → horários. Nunca chame find_available_slots nem peça confirmação final sem doctor_id UUID (via list_doctors / offered_doctors).",
    "- REMARCAÇÃO: se o contexto indicar médico/procedimento já definidos pela consulta focada, NÃO reinicie agendamento — peça só o novo dia/horário e use find_available_slots → reschedule_appointment.",
    "- CHECK-IN: liste/selecione a consulta elegível e use perform_check_in após confirmação — não invente elegibilidade nem horários de janela.",
    "- Se a operação já estiver concluída, não peça confirmação de consulta de novo; responda direto.",
    "- Nunca anuncie ações futuras que dependem de tools (ex.: \"Vou listar\", \"Vou buscar\", \"Estou verificando\"). Comunique apenas resultados já obtidos pelas tools.",
    "- Se needs_input pedir doctor_id em agendamento novo, chame list_doctors e apresente as opções — nunca invente UUID, índice ou o id do paciente.",
    "- Nunca peça telefone — já temos pelo WhatsApp.",
    "- Aceite CPF em qualquer formato; o sistema normaliza automaticamente. Nunca peça 'sem pontuação'.",
    "- Se o snapshot indicar CPF ou e-mail já cadastrados, não pergunte novamente.",
    '- Se paciente responder número ("1", "2"), use options da última tool ou offered_* para o id correto.',
    '- "Marca qualquer um" → escolha a primeira opção disponível e continue; NÃO transfira para humano.',
    `- Tom: ${ctx.tone}. ${emojiPolicy}`
  );

  if (ctx.knowledgePackageText?.trim()) {
    lines.push("", ctx.knowledgePackageText.trim());
  } else {
    if (ctx.hoursText) lines.push(`Horário de funcionamento: ${ctx.hoursText}`);
    if (ctx.address) lines.push(`Endereço: ${ctx.address}`);
  }

  if (ctx.faqs.length && !ctx.knowledgePackageText?.includes("# Base de conhecimento")) {
    lines.push("", "Perguntas frequentes disponíveis via search_faq.");
  }

  const contextBlock = formatContextForPrompt(ctx.facts, ctx.aiState);
  if (contextBlock) {
    lines.push("", contextBlock);
  }

  if (ctx.flowBlock) {
    lines.push("", "Fluxo conversacional (siga o foco atual):", ctx.flowBlock);
  }

  return lines.join("\n");
}
