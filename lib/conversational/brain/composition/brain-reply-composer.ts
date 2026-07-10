import type { TurnContext } from "../types/turn-context";
import type { ReasoningState } from "../reasoning/reasoner";
import { applyReplyGuards } from "./reply-guards";

function formatServicesList(services: Array<{ name: string }>): string {
  return services.slice(0, 12).map((s, i) => `${i + 1}. ${s.name}`).join("\n");
}

function formatSlots(slots: unknown): string | null {
  if (!slots) return null;
  if (Array.isArray(slots)) {
    const lines = slots.slice(0, 8).map((s, i) => {
      if (typeof s === "string") return `${i + 1}. ${s}`;
      if (s && typeof s === "object" && "display" in s) return `${i + 1}. ${String((s as { display: string }).display)}`;
      if (s && typeof s === "object" && "start" in s) return `${i + 1}. ${String((s as { start: string }).start)}`;
      return `${i + 1}. Horário disponível`;
    });
    return lines.join("\n");
  }
  if (typeof slots === "object" && slots !== null && "display_message" in slots) {
    return String((slots as { display_message: string }).display_message);
  }
  return null;
}

export class BrainReplyComposer {
  compose(
    reasoning: ReasoningState,
    ctx: TurnContext,
    toolFacts: Record<string, unknown>,
    previousReplies: string[] = []
  ): string {
    const action = reasoning.chosenAction;
    const payload = action.payload;

    if ("askType" in payload) {
      const procName =
        reasoning.goal.target?.name ??
        String(reasoning.state.entities.procedure?.value ?? "");

      switch (payload.askType) {
        case "greet":
          return applyReplyGuards(
            `Olá! Sou ${ctx.config.assistantName}. Como posso ajudar?`,
            previousReplies,
            "neutral"
          );
        case "ask_date":
          return applyReplyGuards(
            procName
              ? `Ótimo${procName ? `, ${procName}` : ""}! Para qual dia você prefere?`
              : "Para qual dia você prefere?",
            previousReplies,
            "neutral"
          );
        case "ask_procedure":
          return applyReplyGuards(
            "Qual procedimento você gostaria de agendar?",
            previousReplies,
            "neutral"
          );
        case "clarify_procedure":
          return applyReplyGuards(
            `Você está falando de ${procName || "endoscopia"}?`,
            previousReplies,
            "neutral"
          );
        case "confirm_booking":
          return applyReplyGuards(
            "Confirmo esse agendamento? Responda *sim* para confirmar.",
            previousReplies,
            "neutral"
          );
        case "present_slots": {
          const slotText = formatSlots(toolFacts.slots);
          if (slotText) {
            return applyReplyGuards(
              `Temos estes horários:\n\n${slotText}\n\nQual prefere?`,
              previousReplies,
              "neutral"
            );
          }
          return applyReplyGuards(
            "Qual horário prefere?",
            previousReplies,
            "neutral"
          );
        }
        default:
          break;
      }
    }

    if ("outcome" in payload) {
      if (payload.outcome === "booking_created") {
        return applyReplyGuards(
          "Consulta agendada com sucesso! Até breve.",
          previousReplies,
          "neutral"
        );
      }
      if (payload.outcome === "price_known") {
        const price = toolFacts.price as { amount?: number; currency?: string } | undefined;
        if (price?.amount != null) {
          const formatted = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: price.currency || "BRL",
          }).format(price.amount);
          return applyReplyGuards(`O valor é ${formatted}.`, previousReplies, "neutral");
        }
      }
    }

    const faq = toolFacts.faq as { answer?: string } | undefined;
    if (faq?.answer) return applyReplyGuards(faq.answer, previousReplies, "neutral");

    const price = toolFacts.price as { amount?: number; currency?: string } | undefined;
    if (price?.amount != null) {
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: price.currency || "BRL",
      }).format(price.amount);
      return applyReplyGuards(`O valor é ${formatted}.`, previousReplies, "neutral");
    }

    const slots = formatSlots(toolFacts.slots);
    if (slots) {
      return applyReplyGuards(
        `Horários disponíveis:\n\n${slots}\n\nQual prefere?`,
        previousReplies,
        "neutral"
      );
    }

    const services = toolFacts.services as Array<{ name: string }> | undefined;
    if (services?.length && !reasoning.state.entities.procedure) {
      return applyReplyGuards(
        `Trabalhamos com:\n\n${formatServicesList(services)}\n\nQuer saber valores ou agendar algum?`,
        previousReplies,
        "neutral"
      );
    }

    if (toolFacts.handoff) {
      return applyReplyGuards(
        "Estou transferindo você para nossa equipe. Aguarde um momento.",
        previousReplies,
        "neutral"
      );
    }

    return applyReplyGuards(
      "Posso ajudar com serviços, valores, agendamentos e outras dúvidas. O que você precisa?",
      previousReplies,
      "neutral"
    );
  }
}
