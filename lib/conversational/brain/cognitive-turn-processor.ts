import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ClinicConfig } from "../clinic/clinic-config";
import type { Conversation } from "../domain/conversation/conversation";
import type { ConversationRepository } from "../domain/conversation/conversation-repository";
import { createToolGateway } from "../tools/adapters/supabase-adapters";
import { ContextBuilder } from "./context/context-builder";
import { ReplyComposer } from "./composition/reply-composer";
import { KnowledgeRouter } from "./knowledge/knowledge-router";
import { MemoryStore } from "./memory/memory-store";
import { Planner } from "./planning/planner";
import { Replanner } from "./planning/replanner";
import { UnderstandingLayer } from "./understanding/understanding-layer";
import type { HistoryMessage } from "./types/messages";

export type CognitiveTurnResult = {
  reply: string;
  silent: boolean;
  handoff: boolean;
  conversation: Conversation;
  brainStatePatch: Partial<AiConversationState>;
  planGoal: string;
  retrievalChain: string[];
};

export class CognitiveTurnProcessor {
  private readonly contextBuilder: ContextBuilder;
  private readonly understanding = new UnderstandingLayer();
  private readonly planner = new Planner();
  private readonly knowledgeRouter = new KnowledgeRouter();
  private readonly replyComposer = new ReplyComposer();
  private readonly memoryStore = new MemoryStore();

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly repository: ConversationRepository,
    private readonly config: ClinicConfig
  ) {
    this.contextBuilder = new ContextBuilder(supabase);
  }

  async process(opts: {
    conversation: Conversation;
    message: string;
    phoneNumber: string;
    aiState: AiConversationState;
    history?: HistoryMessage[];
  }): Promise<CognitiveTurnResult> {
    const turnId = randomUUID();
    const expectedVersion = opts.conversation.version;

    const ctx = await this.contextBuilder.build({
      conversation: opts.conversation,
      config: this.config,
      message: opts.message,
      phoneNumber: opts.phoneNumber,
      turnId,
      aiState: opts.aiState,
      history: opts.history,
    });

    const understanding = await this.understanding.analyze(ctx);
    let plan = await this.planner.plan(ctx, understanding);
    plan = await this.knowledgeRouter.enrichPlan(plan, ctx);

    const gateway = createToolGateway(this.supabase, this.config);
    const replanner = new Replanner();
    let bundle = await this.knowledgeRouter.executePlan(plan, ctx, {
      supabase: this.supabase,
      config: this.config,
      gateway,
      aiState: opts.aiState,
    });

    while (bundle.needsReplan && replanner.canReplan()) {
      const newPlan = replanner.replan(plan, bundle, ctx, understanding);
      if (!newPlan) break;
      plan = newPlan;
      bundle = await this.knowledgeRouter.executePlan(plan, ctx, {
        supabase: this.supabase,
        config: this.config,
        gateway,
        aiState: opts.aiState,
      });
      bundle.replanCount += 1;
    }

    const previousReplies = ctx.history
      .filter((m) => m.role === "assistant")
      .map((m) => m.content);

    const reply = await this.replyComposer.compose(
      plan,
      bundle,
      ctx,
      understanding,
      previousReplies
    );

    const brainState = this.memoryStore.applyAfterTurn({
      conversation: opts.conversation,
      understanding,
      plan,
      bundle,
      previous: ctx.operationalMemory,
    });

    if (plan.handoff) {
      opts.conversation.enterHandoff(`brain-${opts.conversation.id}-${Date.now()}`);
    }

    await this.repository.save(opts.conversation, expectedVersion);

    logAiEvent(this.supabase, {
      clinicId: opts.conversation.clinicId,
      conversationId: opts.conversation.id,
      stage: "brain_turn",
      detail: {
        turnId,
        primaryGoal: plan.primaryGoal,
        source: plan.source,
        retrievalChain: bundle.retrievalChain,
        replanCount: bundle.replanCount,
        replyPreview: reply.slice(0, 120),
      },
    });

    return {
      reply,
      silent: false,
      handoff: Boolean(plan.handoff),
      conversation: opts.conversation,
      brainStatePatch: this.memoryStore.toAiStatePatch(brainState),
      planGoal: plan.primaryGoal,
      retrievalChain: bundle.retrievalChain,
    };
  }
}
