import { createChatCompletion } from "@/lib/virtual-assistant/openai-client";
import type { TurnContext } from "../types/turn-context";
import type { InfoNeed, PrimaryGoal, Understanding } from "../types/understanding";
import {
  defaultMenuShown,
  menuGoalFromReference,
  resolveMenuReference,
} from "./menu-reference-resolver";

const DISCOVERY_PATTERN =
  /com o que (vocês|vcs|trabalham|fazem)|o que (vocês|vcs) (fazem|oferecem|trabalham)|quais (serviços|servicos|especialidades|procedimentos)|trabalham com/i;

function keywordUnderstanding(ctx: TurnContext): Understanding {
  const lower = ctx.message.toLowerCase().trim();
  const menuRef = resolveMenuReference(ctx.message, ctx.operationalMemory);

  if (menuRef !== null) {
    const goal = menuGoalFromReference(menuRef);
    return {
      primaryGoal: goal === "clarify" ? "clarify" : (goal as PrimaryGoal),
      infoNeeds: goal === "clarify" ? ["general"] : [],
      entities: {},
      missingEntities: [],
      menuReference: menuRef,
      sentiment: "neutral",
      confidence: 0.9,
      rawSummary: `Menu option ${menuRef}`,
    };
  }

  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hi)\b/i.test(lower)) {
    return {
      primaryGoal: "greet",
      infoNeeds: [],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "positive",
      confidence: 0.9,
      rawSummary: "Saudação",
    };
  }

  if (DISCOVERY_PATTERN.test(lower) || /serviço|servico|especialidade|procedimento/i.test(lower)) {
    return {
      primaryGoal: "inform",
      infoNeeds: ["what_we_do"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.88,
      rawSummary: "Pergunta sobre serviços da clínica",
    };
  }

  if (/preço|preco|valor|quanto custa/i.test(lower)) {
    return {
      primaryGoal: "price",
      infoNeeds: ["pricing"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.85,
      rawSummary: "Consulta de preço",
    };
  }

  if (/horário de funcionamento|horario de funcionamento|funcionamento|endereço|endereco|onde fica|localiza/i.test(lower)) {
    return {
      primaryGoal: "inform",
      infoNeeds: ["institutional"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.88,
      rawSummary: "Pergunta institucional",
    };
  }

  if (/agendar|marcar|consulta|horário|horario|vaga/i.test(lower)) {
    return {
      primaryGoal: "book",
      infoNeeds: ["availability"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.85,
      rawSummary: "Intenção de agendamento",
    };
  }

  if (/^(obrigad|valeu|agradeço|agradeco)/i.test(lower)) {
    return {
      primaryGoal: "greet",
      infoNeeds: [],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "positive",
      confidence: 0.85,
      rawSummary: "Agradecimento",
    };
  }

  if (/^tenho uma dúvida$|^tenho uma duvida$/i.test(lower)) {
    return {
      primaryGoal: "clarify",
      infoNeeds: ["general"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.9,
      rawSummary: "Pedido de clarificação",
    };
  }

  if (/atendente|humano|pessoa/i.test(lower)) {
    if (/não quero|nao quero|sem atendente/i.test(lower)) {
      return {
        primaryGoal: "inform",
        infoNeeds: ["what_we_do"],
        entities: {},
        missingEntities: [],
        menuReference: null,
        sentiment: "frustrated",
        confidence: 0.85,
        rawSummary: "Recusa atendente humano",
      };
    }
    return {
      primaryGoal: "handoff",
      infoNeeds: [],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.9,
      rawSummary: "Pedido de atendente humano",
    };
  }

  if (/não quero falar com|nao quero falar com|quero falar com você mesmo/i.test(lower)) {
    return {
      primaryGoal: "inform",
      infoNeeds: ["what_we_do"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "frustrated",
      confidence: 0.85,
      rawSummary: "Frustração; quer ajuda do bot",
    };
  }

  return {
    primaryGoal: "inform",
    infoNeeds: ["general"],
    entities: {},
    missingEntities: [],
    menuReference: null,
    sentiment: "neutral",
    confidence: 0.5,
    rawSummary: ctx.message.slice(0, 120),
  };
}

async function llmUnderstanding(ctx: TurnContext): Promise<Understanding | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const historyText = ctx.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  try {
    const result = await createChatCompletion({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content: `Analise a mensagem do paciente de uma clínica médica no WhatsApp.
Retorne JSON: {"primaryGoal":"inform|book|price|crm|handoff|clarify|confirm|greet","infoNeeds":["what_we_do"|"pricing"|"availability"|"institutional"|"patient_history"|"general"],"entities":{},"missingEntities":[],"menuReference":null,"sentiment":"neutral|frustrated|positive","confidence":0.0-1.0,"rawSummary":"..."}
Regras: "com o que trabalham" = inform + what_we_do. Menu numérico sozinho = clarify. Nunca handoff se paciente rejeita atendente.`,
        },
        {
          role: "user",
          content: `Histórico:\n${historyText}\n\nMensagem atual: ${ctx.message}`,
        },
      ],
    });

    const raw = result.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Understanding;
    if (!parsed.primaryGoal) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class UnderstandingLayer {
  async analyze(ctx: TurnContext): Promise<Understanding> {
    const llm = await llmUnderstanding(ctx);
    if (llm && llm.confidence >= 0.6) return llm;
    return keywordUnderstanding(ctx);
  }
}

export { defaultMenuShown };
