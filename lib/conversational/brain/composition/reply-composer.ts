import { createChatCompletion } from "@/lib/virtual-assistant/openai-client";
import type { ExecutionBundle } from "../types/execution";
import type { TurnContext } from "../types/turn-context";
import type { TurnPlan } from "../types/turn-plan";
import type { Understanding } from "../types/understanding";
import { applyReplyGuards } from "./reply-guards";

function formatServicesList(services: Array<{ name: string }>): string {
  return services
    .slice(0, 12)
    .map((s, i) => `${i + 1}. ${s.name}`)
    .join("\n");
}

function deterministicCompose(
  plan: TurnPlan,
  bundle: ExecutionBundle,
  ctx: TurnContext,
  understanding: Understanding
): string | null {
  if (plan.clarify && !bundle.facts.services && !bundle.facts.faq) {
    return plan.clarify;
  }

  if (plan.primaryGoal === "greet") {
    return `Olá! Sou ${ctx.config.assistantName}. Como posso ajudar?`;
  }

  if (plan.handoff) {
    return "Certo, vamos passar para alguém da nossa equipe continuar seu atendimento.";
  }

  const services = bundle.facts.services as Array<{ name: string }> | undefined;
  if (services?.length) {
    const list = formatServicesList(services);
    if (understanding.sentiment === "frustrated") {
      return `Sem problema, vou te ajudar por aqui! Trabalhamos com:\n\n${list}\n\nQuer saber valores ou agendar algum?`;
    }
    return `Trabalhamos com:\n\n${list}\n\nQuer saber valores ou agendar algum?`;
  }

  const faq = bundle.facts.faq as { answer?: string } | undefined;
  if (faq?.answer) return faq.answer;

  const price = bundle.facts.price as
    | { amount?: number; currency?: string; breakdown?: string }
    | undefined;
  const slots = bundle.facts.slots as { display_message?: string; slots?: unknown[] } | undefined;

  if (price?.amount != null) {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: price.currency || "BRL",
    }).format(price.amount);
    let reply = `O valor é ${formatted}${price.breakdown ? ` (${price.breakdown})` : ""}.`;
    if (slots?.display_message) {
      reply += `\n\n${slots.display_message}`;
    } else if (slots?.slots) {
      reply += "\n\nPosso verificar horários disponíveis se quiser agendar.";
    }
    return reply;
  }

  if (slots?.display_message) return slots.display_message;

  const procedures = bundle.facts.procedures as Array<{ name: string }> | undefined;
  if (procedures?.length) {
    return `Trabalhamos com:\n\n${formatServicesList(procedures)}\n\nQuer saber mais sobre algum?`;
  }

  return null;
}

export class ReplyComposer {
  async compose(
    plan: TurnPlan,
    bundle: ExecutionBundle,
    ctx: TurnContext,
    understanding: Understanding,
    previousReplies: string[] = []
  ): Promise<string> {
    const deterministic = deterministicCompose(plan, bundle, ctx, understanding);
    if (deterministic) {
      return applyReplyGuards(deterministic, previousReplies, understanding.sentiment);
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const result = await createChatCompletion({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0.4,
          maxTokens: 400,
          messages: [
            {
              role: "system",
              content: `Você é ${ctx.config.assistantName}, atendente da clínica ${ctx.clinicSummary.clinicName} no WhatsApp.
Reformule resposta em português brasileiro, tom humano e objetivo.
NUNCA invente preços, horários ou nomes. Use APENAS os fatos fornecidos.
Se fatos insuficientes, peça clarificação.`,
            },
            {
              role: "user",
              content: `Mensagem do paciente: ${ctx.message}
Fatos: ${JSON.stringify(bundle.facts).slice(0, 2000)}
${plan.clarify ? `Sugestão: ${plan.clarify}` : ""}`,
            },
          ],
        });
        const text = result.content?.trim();
        if (text) {
          return applyReplyGuards(text, previousReplies, understanding.sentiment);
        }
      } catch {
        // fall through
      }
    }

    return applyReplyGuards(
      plan.clarify ??
        "Posso ajudar com serviços, valores, agendamentos e outras dúvidas. O que você precisa?",
      previousReplies,
      understanding.sentiment
    );
  }
}
