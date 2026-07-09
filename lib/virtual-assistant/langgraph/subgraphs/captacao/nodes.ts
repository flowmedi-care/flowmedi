import { hasActiveBookingContext, hasOfferedBookingSelection, isDormantBookingState } from "@/lib/virtual-assistant/booking-continuity-guards";
import { isSlotSelectionMessage } from "@/lib/virtual-assistant/booking-slot-messages";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { CAPTACAO_GREETING_MENU } from "../../trace";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";
import { runAgendamentoSubgraph } from "../agendamento/graph";
import { buildOrcamentoGraph } from "../orcamento/graph";

function shouldDelegateToAgendamento(state: GraphState): boolean {
  if (isDormantBookingState(state.aiState)) return false;
  if (hasActiveBookingContext(state.aiState)) return true;
  if (!isSlotSelectionMessage(state.inboundText)) return false;
  if (!state.aiState.procedure_id || !state.aiState.doctor_id) return false;
  return (
    hasOfferedBookingSelection(state.aiState) ||
    Boolean(state.aiState.booking_step && state.aiState.booking_step !== "done")
  );
}

async function buildDiscoveryProceduresReply(state: GraphState): Promise<Partial<GraphState> | null> {
  const ctx = state.runtimeContext;
  if (!ctx) return null;

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
    return mergeStageResult(
      {
        reply: applyReplyGuards(
          "Trabalhamos com diversos procedimentos médicos. Quer que eu chame alguém da equipe para detalhar?",
          state.aiState
        ),
        stageSubgraphComplete: true,
      },
      "captacao"
    );
  }

  const list = procedures.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}`).join("\n");
  return mergeStageResult(
    {
      reply: applyReplyGuards(
        `Trabalhamos com os seguintes procedimentos e consultas:\n\n${list}\n\nSe quiser agendar ou saber valores, é só me dizer.`,
        state.aiState
      ),
      stageSubgraphComplete: true,
    },
    "captacao"
  );
}

export async function captacaoRouteNode(state: GraphState): Promise<Partial<GraphState>> {
  if (state.detectedIntent === "pricing" || state.detectedIntent === "quote") {
    const graph = buildOrcamentoGraph();
    const result = await graph.invoke({
      ...state,
      pipelineStage: "orcamento",
      aiState: { ...state.aiState, intent: "pricing" },
    });
    return result as Partial<GraphState>;
  }

  if (state.detectedIntent === "general") {
    const discovery = await buildDiscoveryProceduresReply(state);
    if (discovery) return discovery;
  }

  if (
    state.detectedIntent === "booking" ||
    state.detectedIntent === "availability_check" ||
    shouldDelegateToAgendamento(state)
  ) {
    const result = await runAgendamentoSubgraph({
      ...state,
      pipelineStage: "agendamento",
      detectedIntent:
        state.detectedIntent === "unknown" ? "availability_check" : state.detectedIntent,
      aiState: {
        ...state.aiState,
        intent: "booking",
        booking_step: state.aiState.booking_step ?? "day",
      },
    });
    return result as Partial<GraphState>;
  }

  if (state.detectedIntent === "greeting") {
    return mergeStageResult(
      {
        reply: applyReplyGuards(CAPTACAO_GREETING_MENU, state.aiState),
        stageSubgraphComplete: true,
      },
      "captacao"
    );
  }

  return { needsToolLoop: true };
}

export function routeAfterCaptacaoRoute(state: GraphState): "done" | "discovery" {
  if (state.stageSubgraphComplete || state.reply?.trim()) return "done";
  if (state.needsToolLoop) return "discovery";
  return "done";
}

export async function captacaoDiscoveryNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop(state);
  return mergeStageResult(result, "captacao");
}
