import type { InfoNeed } from "../types/understanding";
import type { TurnPlan } from "../types/turn-plan";
import type { TurnContext } from "../types/turn-context";
import type { Understanding } from "../types/understanding";

function extractServiceQuery(message: string): string {
  const cleaned = message
    .replace(/quanto custa|preço|preco|valor|tem vaga|amanhã|amanha|hoje/gi, "")
    .trim();
  return cleaned || message.trim();
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildPlanFromTemplate(
  ctx: TurnContext,
  understanding: Understanding
): TurnPlan | null {
  const msg = ctx.message.toLowerCase();

  if (understanding.primaryGoal === "greet") {
    return {
      primaryGoal: "greet",
      subGoals: ["welcome"],
      toolSteps: [],
      confidence: 0.95,
      source: "template",
    };
  }

  if (understanding.primaryGoal === "clarify" || understanding.menuReference === 3) {
    return {
      primaryGoal: "clarify",
      subGoals: ["ask_question"],
      toolSteps: [],
      clarify: "Claro! Qual sua dúvida?",
      confidence: 0.95,
      source: "template",
    };
  }

  if (understanding.infoNeeds.includes("institutional")) {
    return {
      primaryGoal: "inform",
      subGoals: ["faq_institutional"],
      toolSteps: [
        {
          id: "s0",
          tool: "searchFaq",
          args: { query: ctx.message },
          parallelizable: true,
          purpose: "Buscar FAQ institucional",
        },
      ],
      confidence: 0.9,
      source: "template",
    };
  }

  if (understanding.infoNeeds.includes("what_we_do") || understanding.primaryGoal === "inform") {
    if (DISCOVERY_MATCH(msg)) {
      return {
        primaryGoal: "inform",
        subGoals: ["list_services"],
        toolSteps: [
          {
            id: "s0",
            tool: "listServices",
            args: {},
            parallelizable: true,
            purpose: "Listar serviços da clínica",
          },
        ],
        confidence: 0.92,
        source: "template",
      };
    }
  }

  if (understanding.primaryGoal === "price") {
    const serviceQuery = extractServiceQuery(ctx.message);
    const steps: TurnPlan["toolSteps"] = [
      {
        id: "s0",
        tool: "listServices",
        args: {},
        parallelizable: true,
        purpose: "Resolver serviço para preço",
      },
      {
        id: "s1",
        tool: "getPriceQuote",
        args: { serviceId: "$s0.matchId", serviceQuery },
        dependsOn: ["s0"],
        parallelizable: false,
        purpose: "Obter preço",
      },
    ];

    if (/vaga|horário|horario|amanhã|amanha|disponível|disponivel/i.test(msg)) {
      steps.push({
        id: "s2",
        tool: "find_available_slots",
        args: { date: tomorrowIso(), serviceQuery },
        dependsOn: ["s0"],
        parallelizable: true,
        purpose: "Verificar disponibilidade",
      });
    }

    return {
      primaryGoal: "price",
      subGoals: ["get_price", "maybe_availability"],
      toolSteps: steps,
      confidence: 0.88,
      source: "template",
    };
  }

  if (understanding.primaryGoal === "book") {
    const serviceQuery = extractServiceQuery(ctx.message);
    const steps: TurnPlan["toolSteps"] = [
      {
        id: "s0",
        tool: "listServices",
        args: {},
        parallelizable: true,
        purpose: "Serviços para agendamento",
      },
    ];

    if (/vaga|horário|horario|amanhã|amanha|disponível|disponivel/i.test(msg)) {
      steps.push({
        id: "s1",
        tool: "find_available_slots",
        args: { date: tomorrowIso(), serviceQuery },
        dependsOn: ["s0"],
        parallelizable: true,
        purpose: "Verificar disponibilidade",
      });
    }

    return {
      primaryGoal: "book",
      subGoals: ["start_booking"],
      toolSteps: steps,
      clarify: steps.length === 1 ? "Qual procedimento você gostaria de agendar?" : undefined,
      confidence: 0.8,
      source: "template",
    };
  }

  if (understanding.primaryGoal === "handoff") {
    return {
      primaryGoal: "handoff",
      subGoals: ["transfer"],
      toolSteps: [
        {
          id: "s0",
          tool: "openHandoffTicket",
          args: {},
          parallelizable: false,
          purpose: "Abrir handoff",
        },
      ],
      handoff: true,
      confidence: 0.9,
      source: "template",
    };
  }

  if (understanding.sentiment === "frustrated") {
    return {
      primaryGoal: "inform",
      subGoals: ["recover_trust", "list_services"],
      toolSteps: [
        {
          id: "s0",
          tool: "listServices",
          args: {},
          parallelizable: true,
          purpose: "Listar serviços após frustração",
        },
      ],
      confidence: 0.85,
      source: "template",
    };
  }

  return null;
}

function DISCOVERY_MATCH(msg: string): boolean {
  return (
    /com o que|trabalham|fazem|serviço|servico|especialidade|procedimento|não sabe|nao sabe|dúvida/.test(
      msg
    ) || msg.includes("?")
  );
}

export function infoNeedToChain(need: InfoNeed): string[] {
  switch (need) {
    case "what_we_do":
      return ["listServices", "list_procedures", "clinic_settings"];
    case "pricing":
      return ["getPriceQuote", "list_price_options", "listServices"];
    case "availability":
      return ["find_available_slots", "list_doctors"];
    case "institutional":
      return ["searchFaq", "clinic_settings"];
    case "patient_history":
      return ["get_contact_journey", "lookup_patient"];
    default:
      return ["searchFaq", "listServices", "clinic_settings"];
  }
}
