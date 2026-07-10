import type { ExecutionBundle } from "../types/execution";
import type { TurnContext } from "../types/turn-context";
import type { TurnPlan } from "../types/turn-plan";
import { infoNeedToChain } from "./plan-templates";
import type { Understanding } from "../types/understanding";

const MAX_REPLANS = 2;

export class Replanner {
  private count = 0;

  canReplan(): boolean {
    return this.count < MAX_REPLANS;
  }

  replan(
    plan: TurnPlan,
    bundle: ExecutionBundle,
    ctx: TurnContext,
    understanding: Understanding
  ): TurnPlan | null {
    if (!this.canReplan()) return null;
    this.count += 1;

    const tried = new Set(bundle.retrievalChain);
    for (const need of understanding.infoNeeds) {
      const chain = infoNeedToChain(need);
      for (const source of chain) {
        if (tried.has(source)) continue;
        return {
          primaryGoal: plan.primaryGoal,
          subGoals: [...plan.subGoals, `fallback_${source}`],
          toolSteps: [
            {
              id: `r${this.count}`,
              tool: mapSourceToTool(source),
              args: source === "searchFaq" ? { query: ctx.message } : {},
              parallelizable: true,
              purpose: `Fallback: ${source}`,
            },
          ],
          confidence: 0.7,
          source: "replan",
        };
      }
    }

    if (!tried.has("listServices")) {
      return {
        primaryGoal: "inform",
        subGoals: ["fallback_services"],
        toolSteps: [
          {
            id: `r${this.count}`,
            tool: "listServices",
            args: {},
            parallelizable: true,
            purpose: "Fallback final: listar serviços",
          },
        ],
        confidence: 0.65,
        source: "replan",
      };
    }

    return {
      primaryGoal: "clarify",
      subGoals: ["clarify"],
      toolSteps: [],
      clarify: "Não encontrei essa informação específica. Pode reformular ou me dizer qual serviço te interessa?",
      confidence: 0.5,
      source: "replan",
    };
  }
}

function mapSourceToTool(
  source: string
): TurnPlan["toolSteps"][number]["tool"] {
  switch (source) {
    case "listServices":
      return "listServices";
    case "list_procedures":
      return "list_procedures";
    case "searchFaq":
      return "searchFaq";
    case "getPriceQuote":
      return "getPriceQuote";
    case "find_available_slots":
      return "find_available_slots";
    default:
      return "listServices";
  }
}
