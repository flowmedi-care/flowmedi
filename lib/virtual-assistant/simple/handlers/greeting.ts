import { applyReplyGuards } from "../../reply-guards";
import type { GraphState } from "../../langgraph/state";
import { CAPTACAO_GREETING_MENU } from "../../langgraph/trace";
import type { PartialGraphUpdate } from "./shared";

export async function handleGreeting(state: GraphState): Promise<PartialGraphUpdate> {
  return {
    reply: applyReplyGuards(CAPTACAO_GREETING_MENU, state.aiState),
    replySource: "deterministic",
    stageSubgraphComplete: true,
  };
}
