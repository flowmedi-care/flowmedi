import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";

export async function formulariosStatusNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return { needsToolLoop: true };

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "formularios",
    },
    "get_form_status",
    { patient_id: state.aiState.patient_id }
  );

  let parsed: { pending?: boolean; message?: string; form_id?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  if (parsed.pending && /reenvi|link|formul/i.test(state.inboundText)) {
    return { needsToolLoop: false, aiState: { ...state.aiState, ...toolResult.statePatch } };
  }

  return mergeStageResult(
    {
      aiState: { ...state.aiState, ...toolResult.statePatch },
      reply: applyReplyGuards(
        parsed.message ?? "Consultei o status do seu formulário.",
        state.aiState
      ),
      stageSubgraphComplete: true,
    },
    "formularios"
  );
}

export function routeAfterFormulariosStatus(state: GraphState): "done" | "resend" | "tool_loop" {
  if (state.stageSubgraphComplete) return "done";
  if (/reenvi|link|formul/i.test(state.inboundText)) return "resend";
  return "done";
}

export async function formulariosResendNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return { needsToolLoop: true };

  if (state.aiState.pending_tool_confirmation?.tool === "resend_form_link") {
    return { needsHumanConfirm: true, needsToolLoop: true };
  }

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "formularios",
    },
    "resend_form_link",
    { patient_id: state.aiState.patient_id }
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
      reply: applyReplyGuards(parsed.message ?? "Enviei o link do formulário.", state.aiState),
      stageSubgraphComplete: true,
    },
    "formularios"
  );
}

export async function formulariosToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop({
    ...state,
    pipelineStage: "formularios",
    aiState: { ...state.aiState, intent: "form" },
  });
  return mergeStageResult(result, "formularios");
}
