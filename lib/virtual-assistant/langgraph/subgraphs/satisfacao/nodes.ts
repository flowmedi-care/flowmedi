import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";

function parseNpsScore(text: string): number | null {
  const m = text.match(/\b(10|[0-9])\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 10 ? n : null;
}

export async function satisfacaoParseNode(state: GraphState): Promise<Partial<GraphState>> {
  const score = parseNpsScore(state.inboundText);
  if (score === null) return { needsToolLoop: true };
  return { aiState: { ...state.aiState, intent: "general" } };
}

export function routeAfterSatisfacaoParse(state: GraphState): "collect" | "tool_loop" {
  if (state.needsToolLoop) return "tool_loop";
  return "collect";
}

export async function satisfacaoCollectNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return { needsToolLoop: true };
  const score = parseNpsScore(state.inboundText);
  if (score === null) return { needsToolLoop: true };

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "satisfacao",
    },
    "collect_nps_feedback",
    {
      score,
      patient_id: state.aiState.patient_id,
      appointment_id: state.aiState.focused_appointment_id,
    }
  );

  let parsed: { message?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  return mergeStageResult(
    {
      aiState: { ...state.aiState, ...toolResult.statePatch },
      reply: applyReplyGuards(parsed.message ?? "Obrigado pelo feedback!", state.aiState),
      stageSubgraphComplete: true,
      pipelineStage: "captacao",
    },
    "captacao"
  );
}

export async function satisfacaoToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop({
    ...state,
    pipelineStage: "satisfacao",
  });
  return mergeStageResult(result, "satisfacao");
}
