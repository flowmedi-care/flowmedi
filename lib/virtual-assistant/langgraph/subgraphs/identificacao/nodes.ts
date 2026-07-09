import { JOURNEY_STEP_TO_PIPELINE_STAGE } from "@/lib/virtual-assistant/agent-pipeline/stages";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { runStageToolLoop } from "../../tools/tool-node";
import { mergeStageResult } from "../build-stage-graph";
import { loadContactJourneyForAi } from "@/lib/contact-journey/journey-for-ai";

export async function identificacaoLookupNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx || state.aiState.patient_id) return {};

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "identificacao",
    },
    "lookup_patient_by_phone",
    {}
  );

  let parsed: { id?: string; full_name?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  if (parsed.id) {
    return mergeStageResult(
      {
        aiState: {
          ...state.aiState,
          ...toolResult.statePatch,
          patient_id: parsed.id,
        },
        reply: applyReplyGuards(
          parsed.full_name
            ? `Olá! Vi que você já está cadastrado(a) como ${parsed.full_name}. Como posso ajudar?`
            : "Olá! Identifiquei seu cadastro. Como posso ajudar?",
          state.aiState
        ),
        stageSubgraphComplete: true,
        pipelineStage: "captacao",
      },
      "captacao"
    );
  }

  return mergeStageResult(
    {
      reply: applyReplyGuards(
        "Olá! Ainda não encontrei seu cadastro. Você quer agendar uma consulta ou saber sobre nossos serviços?",
        state.aiState
      ),
      stageSubgraphComplete: true,
      pipelineStage: "captacao",
    },
    "captacao"
  );
}

export function routeAfterIdentificacaoLookup(state: GraphState): "done" | "journey" {
  return state.stageSubgraphComplete ? "done" : "journey";
}

export async function identificacaoJourneyNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return { needsToolLoop: true };

  const journeyRes = await loadContactJourneyForAi(ctx.supabase, {
    clinicId: ctx.clinicId,
    phone: ctx.phoneNumber,
    patientId: state.aiState.patient_id,
  }).catch(() => ({ summary: null, journey: null }));

  const step = journeyRes.journey?.currentStep;
  const targetStage = step ? JOURNEY_STEP_TO_PIPELINE_STAGE[step] : undefined;

  if (targetStage && targetStage !== "identificacao") {
    const { invokeStageSubgraph } = await import("../registry");
    const routed = await invokeStageSubgraph(targetStage, {
      ...state,
      pipelineStage: targetStage,
      aiState: {
        ...state.aiState,
        journey_step_code: step,
        pipeline_stage: targetStage,
      },
    });
    return routed;
  }

  return { needsToolLoop: true };
}

export function routeAfterIdentificacaoJourney(state: GraphState): "routed" | "tool_loop" {
  if (state.needsToolLoop) return "tool_loop";
  if (state.stageSubgraphComplete || state.reply?.trim()) return "routed";
  if (state.pipelineStage !== "identificacao") return "routed";
  return "tool_loop";
}

export async function identificacaoToolLoopNode(state: GraphState): Promise<Partial<GraphState>> {
  const result = await runStageToolLoop(state);
  return mergeStageResult(result, "identificacao");
}

export function resolveExitStageFromJourney(step?: string | null) {
  if (!step) return "captacao" as const;
  return JOURNEY_STEP_TO_PIPELINE_STAGE[step] ?? ("captacao" as const);
}
