import type { HandlerContext, DomainHandler } from "./handler-types";
import { literalReply } from "./handler-types";
import { isGreeting, resolveIdleIntentFromKeywords } from "../../fsm/idle-entry";

/** @deprecated Brain v2 uses planner-first pipeline. */
export class IdleHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    const text = ctx.input.text.trim();

    if (text && !isGreeting(text)) {
      const intent = resolveIdleIntentFromKeywords(text);
      if (intent === "discovery") {
        return {
          type: "stay" as const,
          reply: literalReply("Deixa eu consultar os serviços da clínica para você."),
        };
      }
      if (text.length > 12 || text.includes("?")) {
        return {
          type: "stay" as const,
          reply: literalReply(
            `Entendi sua mensagem. Posso ajudar com serviços, valores, agendamentos e outras dúvidas — é só me dizer o que você precisa.`
          ),
        };
      }
    }

    return {
      type: "stay" as const,
      reply: literalReply(
        `Olá! Sou ${ctx.config.assistantName}. Como posso ajudar?\n\n1 — Agendar consulta\n2 — Preços\n3 — Dúvidas\n4 — Deixar contato\n5 — Falar com atendente`
      ),
    };
  }
}

export const idleHandler = new IdleHandler();
