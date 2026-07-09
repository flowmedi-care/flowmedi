import { applyReplyGuards } from "../../reply-guards";
import { executeAssistantTool } from "../../tools";
import type { GraphState } from "../../langgraph/state";
import type { PartialGraphUpdate } from "./shared";

export async function handleDiscovery(state: GraphState): Promise<PartialGraphUpdate> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "captacao",
    },
    "list_procedures",
    {}
  );

  let parsed: { procedures?: { id: string; name: string }[] } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  const procedures = parsed.procedures ?? [];
  if (procedures.length === 0) {
    return {
      reply: applyReplyGuards(
        "Trabalhamos com diversos procedimentos médicos. Quer que eu chame alguém da equipe para detalhar?",
        state.aiState
      ),
      replySource: "deterministic",
      stageSubgraphComplete: true,
    };
  }

  const list = procedures.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}`).join("\n");
  return {
    reply: applyReplyGuards(
      `Trabalhamos com os seguintes procedimentos e consultas:\n\n${list}\n\nSe quiser agendar ou saber valores, é só me dizer.`,
      state.aiState
    ),
    replySource: "deterministic",
    stageSubgraphComplete: true,
  };
}
