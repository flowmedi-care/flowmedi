import { createChatCompletion } from "@/lib/virtual-assistant/openai-client";
import type { TurnContext } from "../types/turn-context";
import type { Understanding } from "../types/understanding";
import type { TurnPlan } from "../types/turn-plan";
import { buildPlanFromTemplate } from "./plan-templates";

export class Planner {
  async plan(ctx: TurnContext, understanding: Understanding): Promise<TurnPlan> {
    const template = buildPlanFromTemplate(ctx, understanding);
    if (template && template.confidence >= 0.8) {
      return template;
    }

    const llmPlan = await this.planWithLlm(ctx, understanding);
    if (llmPlan) return llmPlan;

    if (template) return template;

    return {
      primaryGoal: understanding.primaryGoal,
      subGoals: understanding.infoNeeds,
      toolSteps: [
        {
          id: "s0",
          tool: "searchFaq",
          args: { query: ctx.message },
          parallelizable: true,
          purpose: "Buscar FAQ",
        },
        {
          id: "s1",
          tool: "listServices",
          args: {},
          parallelizable: true,
          purpose: "Fallback serviços",
        },
      ],
      clarify: understanding.confidence < 0.5 ? "Pode me contar um pouco mais sobre o que você precisa?" : undefined,
      confidence: understanding.confidence,
      source: "template",
    };
  }

  private async planWithLlm(
    ctx: TurnContext,
    understanding: Understanding
  ): Promise<TurnPlan | null> {
    if (!process.env.OPENAI_API_KEY) return null;
    try {
      const result = await createChatCompletion({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 500,
        messages: [
          {
            role: "system",
            content: `Gere um plano JSON para atendimento de clínica: {"primaryGoal":"inform|book|price|...","subGoals":[],"toolSteps":[{"id":"s0","tool":"listServices|searchFaq|getPriceQuote|find_available_slots|openHandoffTicket","args":{},"parallelizable":true,"purpose":"..."}],"clarify":null,"handoff":false,"confidence":0.9}
Use múltiplas tools quando a pergunta combinar preço e disponibilidade. Nunca retorne plano vazio para perguntas sobre serviços — use listServices.`,
          },
          {
            role: "user",
            content: `Mensagem: ${ctx.message}\nUnderstanding: ${JSON.stringify(understanding)}`,
          },
        ],
      });
      const raw = result.content?.trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TurnPlan;
      return { ...parsed, source: "llm" };
    } catch {
      return null;
    }
  }
}
