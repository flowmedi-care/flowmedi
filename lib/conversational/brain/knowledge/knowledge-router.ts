import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ClinicConfig } from "../../clinic/clinic-config";
import type { ToolGateway } from "../../tools/gateway";
import type { ToolName } from "../../tools/registry";
import type { ExecutionBundle, StepResult } from "../types/execution";
import type { TurnContext } from "../types/turn-context";
import type { TurnPlan, ToolStep } from "../types/turn-plan";
import type { Understanding } from "../types/understanding";
import { groupToolStepsIntoWaves } from "../execution/tool-planner";
import { enrichPlanWithFallbacks, searchFaqWithFallback } from "./faq-retrieval";

type LegacyTool =
  | "list_procedures"
  | "find_available_slots"
  | "get_service_price"
  | "list_price_options"
  | "lookup_patient"
  | "get_contact_journey";

async function runLegacyTool(
  supabase: SupabaseClient,
  ctx: TurnContext,
  tool: LegacyTool | string,
  args: Record<string, unknown>,
  aiState: AiConversationState
): Promise<StepResult> {
  const result = await executeAssistantTool(
    {
      supabase,
      clinicId: ctx.conversation.clinicId,
      conversationId: ctx.conversation.id,
      phoneNumber: ctx.phoneNumber,
      aiState,
      pipelineStage: "captacao",
    },
    tool,
    args
  );

  let data: unknown = result.result;
  let error: string | undefined;
  try {
    const parsed = JSON.parse(result.result) as { error?: string };
    data = parsed;
    if (parsed.error) error = parsed.error;
  } catch {
    // keep string
  }

  return {
    stepId: String(tool),
    tool: String(tool),
    ok: !error,
    data: error ? undefined : data,
    error,
  };
}

async function runNorthStarTool(
  ctx: TurnContext,
  step: ToolStep,
  gateway: ToolGateway
): Promise<StepResult> {
  const result = await gateway.execute(
    { name: step.tool as ToolName, args: step.resolvedArgs ?? step.args },
    {
      clinicId: ctx.conversation.clinicId,
      conversationId: ctx.conversation.id,
      phoneNumber: ctx.phoneNumber,
      domain: "brain",
      fsmState: "brain.active",
      turnId: ctx.turnId,
    }
  );

  return {
    stepId: step.id,
    tool: step.tool,
    ok: result.ok,
    data: result.ok ? result.data : undefined,
    error: result.ok ? undefined : result.error,
  };
}

function resolveArgRefs(
  args: Record<string, unknown>,
  facts: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.startsWith("$")) {
      const ref = value.slice(1);
      if (ref === "s0.matchId" && facts.matchId) {
        resolved[key] = facts.matchId;
      } else if (facts[ref]) {
        resolved[key] = facts[ref];
      } else {
        resolved[key] = value;
      }
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function pickServiceMatch(
  list: Array<{ id: string; name: string }>,
  query?: string
): { id: string; name: string } | null {
  if (!list.length) return null;
  if (!query) return list[0];
  const lower = query.toLowerCase();
  return (
    list.find((s) => s.name.toLowerCase().includes(lower)) ??
    list.find((s) => lower.includes(s.name.toLowerCase().slice(0, 4))) ??
    list[0]
  );
}

function applyStepFacts(
  step: ToolStep,
  result: StepResult,
  resolvedArgs: Record<string, unknown>,
  ctx: TurnContext,
  facts: Record<string, unknown>
): void {
  if (!result.ok) return;

  if (step.tool === "listServices" && result.data) {
    const list = result.data as Array<{ id: string; name: string }>;
    const match = pickServiceMatch(
      list,
      String(resolvedArgs.serviceQuery ?? ctx.message)
    );
    if (match) {
      facts.matchId = match.id;
      facts.matchName = match.name;
      facts.services = list;
    }
  }

  if (step.tool === "list_procedures" && result.data) {
    const parsed = result.data as { procedures?: Array<{ id: string; name: string }> };
    facts.procedures = parsed.procedures ?? [];
  }

  if (step.tool === "getPriceQuote" && result.data) {
    facts.price = result.data;
  }

  if (step.tool === "find_available_slots" && result.data) {
    facts.slots = result.data;
  }

  if (step.tool === "searchFaq" && result.data) {
    facts.faq = result.data;
  }
}

export class KnowledgeRouter {
  async enrichPlan(
    plan: TurnPlan,
    ctx: TurnContext,
    understanding?: Understanding
  ): Promise<TurnPlan> {
    if (!understanding) return plan;
    return enrichPlanWithFallbacks(plan, ctx, understanding.infoNeeds);
  }

  async executePlan(
    plan: TurnPlan,
    ctx: TurnContext,
    deps: {
      supabase: SupabaseClient;
      config: ClinicConfig;
      gateway: ToolGateway;
      aiState: AiConversationState;
    }
  ): Promise<ExecutionBundle> {
    const results: StepResult[] = [];
    const facts: Record<string, unknown> = {};
    const retrievalChain: string[] = [];
    const waves = groupToolStepsIntoWaves(plan.toolSteps);

    const executeOne = async (step: ToolStep): Promise<StepResult> => {
      const resolvedArgs = resolveArgRefs(step.args, facts);
      step.resolvedArgs = resolvedArgs;
      retrievalChain.push(step.tool);

      if (step.tool === "searchFaq") {
        const query = String(resolvedArgs.query ?? ctx.message);
        const faqHit = await searchFaqWithFallback(
          query,
          deps.config.faqs,
          deps.supabase,
          ctx.conversation.clinicId
        );
        return {
          stepId: step.id,
          tool: step.tool,
          ok: Boolean(faqHit),
          data: faqHit,
        };
      }

      if (
        step.tool === "list_procedures" ||
        step.tool === "find_available_slots" ||
        step.tool === "get_service_price" ||
        step.tool === "list_price_options" ||
        step.tool === "get_contact_journey" ||
        step.tool === "lookup_patient"
      ) {
        return runLegacyTool(deps.supabase, ctx, step.tool, resolvedArgs, deps.aiState);
      }

      return runNorthStarTool(ctx, step, deps.gateway);
    };

    for (const wave of waves) {
      const serial = wave.filter((s) => !s.parallelizable);
      const parallel = wave.filter((s) => s.parallelizable);

      for (const step of serial) {
        const result = await executeOne(step);
        results.push(result);
        applyStepFacts(step, result, step.resolvedArgs ?? step.args, ctx, facts);
      }

      if (parallel.length > 0) {
        const parallelResults = await Promise.all(parallel.map((step) => executeOne(step)));
        for (let i = 0; i < parallel.length; i++) {
          const step = parallel[i];
          const result = parallelResults[i];
          results.push(result);
          applyStepFacts(step, result, step.resolvedArgs ?? step.args, ctx, facts);
        }
      }
    }

    const hasUsefulData = Boolean(
      facts.services || facts.procedures || facts.price || facts.slots || facts.faq
    );
    const anyOk = results.some((r) => r.ok && r.data);

    return {
      results,
      needsReplan: !hasUsefulData && !anyOk && plan.toolSteps.length > 0,
      replanCount: 0,
      retrievalChain,
      facts,
    };
  }
}
