import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ClinicConfig } from "../clinic/clinic-config";
import type { Conversation } from "../domain/conversation/conversation";
import type { ConversationRepository } from "../domain/conversation/conversation-repository";
import { createToolGateway } from "../tools/adapters/supabase-adapters";
import { ContextBuilder } from "./context/context-builder";
import { BrainReplyComposer } from "./composition/brain-reply-composer";
import { executeAction } from "./execution/action-executor";
import { BrainMemoryStore, readBrainV2State } from "./memory/brain-memory-store";
import { Perception } from "./perception/perception";
import { Reasoner } from "./reasoning/reasoner";
import type { HistoryMessage } from "./types/messages";
import type { EpisodeTurn } from "./types/episode";

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
  private readonly perception = new Perception();
  private readonly reasoner = new Reasoner();
  private readonly replyComposer = new BrainReplyComposer();
  private readonly memoryStore = new BrainMemoryStore();

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

    const brainState = readBrainV2State(opts.aiState);
    const perceived = this.perception.extract(
      ctx.message,
      ctx.clinicSummary,
      ctx.operationalMemory
    );

    const gateway = createToolGateway(this.supabase, this.config);
    const retrievalChain: string[] = [];
    let toolFacts: Record<string, unknown> = {};
    let thinkCycles = 0;

    let reasoning = this.reasoner.think({
      perceived,
      memory: ctx.operationalMemory,
    });

    while (reasoning.decision.type === "TOOL" && thinkCycles < 3) {
      thinkCycles += 1;
      const observation = await executeAction(reasoning.chosenAction, ctx, {
        supabase: this.supabase,
        config: this.config,
        gateway,
        aiState: opts.aiState,
      });

      if ("tool" in reasoning.chosenAction.payload) {
        retrievalChain.push(reasoning.chosenAction.payload.tool);
      }

      toolFacts = { ...toolFacts, ...observation.facts };

      if (!observation.ok) break;

      reasoning = this.reasoner.think({
        perceived,
        memory: {
          ...ctx.operationalMemory,
          stateEntities: reasoning.state.entities,
          activeGoalData: reasoning.goal,
          selections: {
            ...ctx.operationalMemory.selections,
            ...(toolFacts.matchId ? { serviceId: String(toolFacts.matchId) } : {}),
          },
        },
        observation: observation.entity
          ? {
              entity: observation.entity,
              value: observation.value,
              status: "known",
            }
          : null,
      });
    }

    const previousReplies = ctx.history
      .filter((m) => m.role === "assistant")
      .map((m) => m.content);

    const reply = this.replyComposer.compose(reasoning, ctx, toolFacts, previousReplies);

    const episodeTurn: EpisodeTurn = {
      turnId,
      timestamp: new Date().toISOString(),
      perceived,
      state: reasoning.state,
      goal: reasoning.goal,
      domain: {
        satisfied: [...reasoning.state.satisfiedNodes],
        unsatisfied: reasoning.unsatisfied,
        reachable: reasoning.reachable,
      },
      remainingCost: reasoning.remainingCost,
      candidates: reasoning.candidates,
      decision: reasoning.decision,
      chosenTransitions: reasoning.chosenAction.postconditions,
      reasoning: reasoning.reasoning,
      toolResults: toolFacts,
    };

    const brainV2 = this.memoryStore.applyAfterTurn({
      conversation: opts.conversation,
      reasoning,
      toolFacts,
      episodeTurn,
      previous: ctx.operationalMemory,
      previousEpisode: brainState.episode,
    });

    const handoff = reasoning.chosenAction.id === "tool.openHandoff" || Boolean(toolFacts.handoff);
    if (handoff) {
      opts.conversation.enterHandoff(`brain-${opts.conversation.id}-${Date.now()}`);
    }

    await this.repository.save(opts.conversation, expectedVersion);

    logAiEvent(this.supabase, {
      clinicId: opts.conversation.clinicId,
      conversationId: opts.conversation.id,
      stage: "brain_turn",
      detail: {
        turnId,
        engine: "brain_v2_p8",
        goal: reasoning.goal,
        desiredNode: reasoning.goal.desiredNode,
        remainingCost: reasoning.remainingCost,
        unsatisfied: reasoning.unsatisfied,
        chosenAction: reasoning.chosenAction.id,
        thinkCycles,
        retrievalChain,
        replyPreview: reply.slice(0, 120),
        reasoning: reasoning.reasoning,
      },
    });

    return {
      reply,
      silent: false,
      handoff,
      conversation: opts.conversation,
      brainStatePatch: this.memoryStore.toAiStatePatch(brainV2),
      planGoal: reasoning.goal.type,
      retrievalChain,
    };
  }
}
