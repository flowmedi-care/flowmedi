import type { HandlerContext, DomainHandler } from "./handler-types";
import { literalReply } from "./handler-types";

function formatServiceList(items: Array<{ name: string }>): string {
  if (items.length === 0) {
    return "Trabalhamos com diversos procedimentos e consultas médicas. Quer que eu detalhe algum em específico?";
  }
  const list = items
    .slice(0, 12)
    .map((item, index) => `${index + 1}. ${item.name}`)
    .join("\n");
  return `Trabalhamos com os seguintes procedimentos e consultas:\n\n${list}\n\nSe quiser agendar ou saber valores, é só me dizer.`;
}

export class DiscoveryHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    const result = await ctx.tools.execute(
      { name: "listServices", args: {} },
      {
        clinicId: ctx.conversation.clinicId,
        conversationId: ctx.conversation.id,
        phoneNumber: ctx.phoneNumber,
        domain: "discovery",
        fsmState: "discovery.present",
        turnId: ctx.turnId,
      }
    );

    if (!result.ok || !result.data) {
      return {
        type: "complete" as const,
        reply: literalReply(
          "Trabalhamos com diversos procedimentos e consultas. Quer que eu detalhe algum em específico?"
        ),
      };
    }

    const list = result.data as Array<{ id: string; name: string }>;
    const flow = ctx.conversation.activeFlow;
    if (flow?.kind === "faq") {
      ctx.conversation.advanceFlow({
        kind: "faq",
        draft: { ...flow.draft, discoveryMode: false, lastQuery: ctx.input.text.trim() || null },
      });
    }

    return {
      type: "complete" as const,
      reply: literalReply(formatServiceList(list)),
    };
  }
}

export const discoveryHandler = new DiscoveryHandler();
