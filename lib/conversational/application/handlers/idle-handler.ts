import type { HandlerContext, DomainHandler } from "./handler-types";
import { literalReply } from "./handler-types";

export class IdleHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    return {
      type: "stay" as const,
      reply: literalReply(
        `Olá! Sou ${ctx.config.assistantName}. Como posso ajudar?\n\n1 — Agendar consulta\n2 — Preços\n3 — Dúvidas\n4 — Deixar contato\n5 — Falar com atendente`
      ),
    };
  }
}

export const idleHandler = new IdleHandler();
