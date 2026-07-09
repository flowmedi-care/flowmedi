import type { GraphState } from "../../langgraph/state";
import { runSimpleToolLoop } from "../tool-loop";
import { filterPricingTools } from "../tools";
import type { PartialGraphUpdate } from "./shared";

export async function handlePricing(state: GraphState): Promise<PartialGraphUpdate> {
  const result = await runSimpleToolLoop(state, {
    tools: filterPricingTools(),
    pipelineStage: "orcamento",
    systemHint:
      "O paciente quer saber preços ou valores. Use list_procedures/list_services e get_service_price ou list_price_options. Responda com valores claros.",
  });
  return {
    ...result,
    replySource: "tool_loop",
    pipelineStage: "orcamento",
  };
}
