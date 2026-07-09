import {
  createPendingToolConfirmation,
  parseToolConfirmationReply,
  requiresHumanConfirm,
  extractToolExecutionModesFromSettings,
} from "../../agent-pipeline";
import type { GraphState } from "../state";

export async function humanConfirmNode(state: GraphState): Promise<Partial<GraphState>> {
  const pending = state.aiState.pending_tool_confirmation;
  if (!pending) {
    return { needsHumanConfirm: false };
  }

  const reply = parseToolConfirmationReply(state.inboundText);
  if (reply === null) {
    return {
      needsHumanConfirm: true,
      reply: pending.prompt_message ?? "Confirma esta ação? Responda *sim* ou *não*.",
      stageSubgraphComplete: true,
    };
  }

  if (reply === "no") {
    return {
      aiState: { ...state.aiState, pending_tool_confirmation: undefined },
      reply: "Tudo bem, não executei a ação. Como posso ajudar?",
      stageSubgraphComplete: true,
      needsHumanConfirm: false,
    };
  }

  return {
    needsHumanConfirm: false,
    needsToolLoop: true,
    aiState: { ...state.aiState, pending_tool_confirmation: undefined },
  };
}

export function checkPendingHumanConfirm(state: GraphState): "confirm" | "skip" {
  if (state.aiState.pending_tool_confirmation) return "confirm";
  if (state.needsHumanConfirm) return "confirm";
  return "skip";
}

export function buildPendingConfirmation(state: GraphState, toolName: string, args: Record<string, unknown>) {
  const ctx = state.runtimeContext;
  const modes = extractToolExecutionModesFromSettings(ctx?.settings ?? {});
  if (!requiresHumanConfirm(toolName, modes)) return null;
  return createPendingToolConfirmation(toolName, args);
}
