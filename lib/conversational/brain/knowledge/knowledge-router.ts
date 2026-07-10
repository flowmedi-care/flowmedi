import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ClinicConfig } from "../../clinic/clinic-config";
import type { ExecutionBundle, StepResult } from "../types/execution";
import type { TurnContext } from "../types/turn-context";
import type { TurnPlan, ToolStep } from "../types/turn-plan";
import { semanticFaqSearch } from "../knowledge/semantic-faq";

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
  try {
    data = JSON.parse(result.result);
  } catch {
    // keep string
  }

  return {
    stepId: String(tool),
    tool: String(tool),
    ok: !result.error,
    data,
    error: result.error,
  };
}

async function runNorthStarTool(
  ctx: TurnContext,
  step: ToolStep,
  gateway: {
    execute: (
      call: { name: string; args: Record<string, unknown> },
      toolCtx: {
        clinicId: string;
        conversationId: string;
        phoneNumber: string;
        domain: string;
        fsmState: string;
        turnId: string;
      }
    ) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  }
): Promise<StepResult> {
  const result = await gateway.execute(
    { name: step.tool as "listServices", args: step.resolvedArgs ?? step.args },
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
    data: result.data,
    error: result.error,
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

export class KnowledgeRouter {
  async enrichPlan(plan: TurnPlan, ctx: TurnContext): Promise<TurnPlan> {
    return plan;
  }

  async executePlan(
    plan: TurnPlan,
    ctx: TurnContext,
    deps: {
      supabase: SupabaseClient;
      config: ClinicConfig;
      gateway: Parameters<typeof runNorthStarTool>[2];
      aiState: AiConversationState;
    }
  ): Promise<ExecutionBundle> {
    const results: StepResult[] = [];
    const facts: Record<string, unknown> = {};
    const retrievalChain: string[] = [];
    const completed = new Map<string, StepResult>();

    const steps = topologicalSort(plan.toolSteps);

    for (const step of steps) {
      const resolvedArgs = resolveArgRefs(step.args, facts);
      step.resolvedArgs = resolvedArgs;
      retrievalChain.push(step.tool);

      let result: StepResult;

      if (step.tool === "searchFaq") {
        const query = String(resolvedArgs.query ?? ctx.message);
        const faqHit = semanticFaqSearch(query, deps.config.faqs);
        result = {
          stepId: step.id,
          tool: step.tool,
          ok: Boolean(faqHit),
          data: faqHit,
        };
      } else if (
        step.tool === "list_procedures" ||
        step.tool === "find_available_slots" ||
        step.tool === "get_service_price" ||
        step.tool === "list_price_options" ||
        step.tool === "get_contact_journey" ||
        step.tool === "lookup_patient"
      ) {
        result = await runLegacyTool(
          deps.supabase,
          ctx,
          step.tool,
          resolvedArgs,
          deps.aiState
        );
      } else {
        result = await runNorthStarTool(ctx, step, deps.gateway);
      }

      results.push(result);
      completed.set(step.id, result);

      if (result.ok && step.tool === "listServices" && result.data) {
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

      if (result.ok && step.tool === "list_procedures" && result.data) {
        const parsed = result.data as { procedures?: Array<{ id: string; name: string }> };
        facts.procedures = parsed.procedures ?? [];
      }

      if (result.ok && step.tool === "getPriceQuote" && result.data) {
        facts.price = result.data;
      }

      if (result.ok && step.tool === "find_available_slots" && result.data) {
        facts.slots = result.data;
      }

      if (result.ok && step.tool === "searchFaq" && result.data) {
        facts.faq = result.data;
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

function topologicalSort(steps: ToolStep[]): ToolStep[] {
  const sorted: ToolStep[] = [];
  const pending = [...steps];
  const done = new Set<string>();

  while (pending.length > 0) {
    const nextIndex = pending.findIndex(
      (s) => !s.dependsOn?.length || s.dependsOn.every((d) => done.has(d))
    );
    if (nextIndex === -1) break;
    const [step] = pending.splice(nextIndex, 1);
    sorted.push(step);
    done.add(step.id);
  }

  return sorted.length ? sorted : steps;
}
