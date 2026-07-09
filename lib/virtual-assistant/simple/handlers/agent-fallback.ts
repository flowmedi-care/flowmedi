import type { GraphState } from "../../langgraph/state";
import { runSimpleToolLoop } from "../tool-loop";
import { filterSimpleAssistantTools } from "../tools";
import type { PartialGraphUpdate } from "./shared";

export async function handleAgentFallback(state: GraphState): Promise<PartialGraphUpdate> {
  const result = await runSimpleToolLoop(state, {
    tools: filterSimpleAssistantTools(),
    pipelineStage: "captacao",
    systemHint:
      "Ajude o paciente com agendamento, preços ou informações da clínica. Se não souber, ofereça falar com a equipe.",
  });
  return {
    ...result,
    replySource: "tool_loop",
    pipelineStage: result.pipelineStage ?? "captacao",
  };
}
