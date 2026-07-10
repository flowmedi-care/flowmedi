import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { Conversation } from "../domain/conversation/conversation";
import { conversationToFsmState } from "../application/domain-fsm-mapper";
import { getHandlerForDomain } from "../application/handlers";
import type { ClinicConfig } from "../clinic/clinic-config";
import { ReplyRenderer } from "./reply-renderer";
import { EffectRunner, appendTurnAudit, flushAuditEffects, type AuditWriter } from "./effect-runner";
import { fsmEngine } from "../fsm/engine";
import { InputResolver } from "../fsm/input-resolver";
import type { ReplySpec, SideEffect, TurnRecord } from "../fsm/side-effects";
import { resolveHandlerDomain } from "../fsm/states";
import type { ConversationRepository } from "../domain/conversation/conversation-repository";
import type { ToolGateway } from "../tools/gateway";
import type { LanguageService } from "../language/language-service";
import { nowTimestamp } from "../domain/shared/timestamp";

export type InboundMessage = {
  conversationId: string;
  clinicId: string;
  channel: "whatsapp" | "instagram" | "webchat";
  externalThreadId: string;
  phoneNumber: string;
  text: string;
  receivedAt?: string;
};

export type ProcessTurnResult = {
  reply: string;
  silent: boolean;
  handoff: boolean;
  conversation: Conversation;
  fsmStateBefore: string;
  fsmStateAfter: string;
  shadow?: boolean;
};

export type TurnProcessorDeps = {
  repository: ConversationRepository;
  tools: ToolGateway;
  language: LanguageService;
  audit?: AuditWriter;
};

export class TurnProcessor {
  private readonly inputResolver: InputResolver;
  private readonly replyRenderer: ReplyRenderer;
  private readonly effectRunner: EffectRunner;

  constructor(private readonly deps: TurnProcessorDeps) {
    this.inputResolver = new InputResolver({ language: deps.language });
    this.replyRenderer = new ReplyRenderer(deps.language);
    this.effectRunner = new EffectRunner(deps.tools);
  }

  async process(
    conversation: Conversation,
    message: InboundMessage,
    config: ClinicConfig
  ): Promise<ProcessTurnResult> {
    const turnId = randomUUID();
    const expectedVersion = conversation.version;
    const fsmStateBefore = conversationToFsmState(conversation);
    conversation.touchUserMessage(message.receivedAt ?? nowTimestamp());

    const resolved = await this.inputResolver.resolve(conversation, message.text, config);

    let receiveTransition = fsmEngine.afterReceive(conversation, resolved, config);
    let effects: SideEffect[] = [...receiveTransition.effects];

    await this.effectRunner.run(effects, turnId);

    let replySpec: ReplySpec | undefined = receiveTransition.reply;
    let outcomeReply: ReplySpec | undefined;

    if (!receiveTransition.skipHandler) {
      const fsmState = conversationToFsmState(conversation);
      const domain = resolveHandlerDomain(fsmState);
      const handler = getHandlerForDomain(domain);
      if (handler) {
        const outcome = await handler.handle({
          conversation,
          config,
          input: resolved,
          tools: this.deps.tools,
          turnId,
          phoneNumber: message.phoneNumber,
        });
        const outcomeTransition = fsmEngine.afterOutcome(conversation, outcome, config);
        effects = [...effects, ...outcomeTransition.effects];
        await this.effectRunner.run(outcomeTransition.effects, turnId);
        outcomeReply = outcome.reply;
        replySpec = outcomeTransition.reply ?? outcome.reply;
      }
    }

    const fsmStateAfter = conversationToFsmState(conversation);
    const finalSpec: ReplySpec =
      replySpec ?? outcomeReply ?? { mode: "literal", text: "Como posso ajudar?" };

    const rendered = await this.replyRenderer.render(finalSpec, config);

    const turnRecord: TurnRecord = {
      conversationId: message.conversationId,
      clinicId: message.clinicId,
      turnId,
      inboundText: message.text,
      fsmStateBefore,
      fsmStateAfter,
      handlerDomain: resolveHandlerDomain(fsmStateAfter),
      replyPreview: rendered.text.slice(0, 200),
      timestamp: nowTimestamp(),
    };

    const auditEffects = appendTurnAudit(effects, turnRecord);
    if (this.deps.audit) {
      await flushAuditEffects(auditEffects, this.deps.audit);
    }

    await this.deps.repository.save(conversation, expectedVersion);

    return {
      reply: rendered.text,
      silent: rendered.silent,
      handoff: conversation.status === "handoff",
      conversation,
      fsmStateBefore,
      fsmStateAfter,
    };
  }
}

export async function createTurnProcessor(
  supabase: SupabaseClient,
  config: ClinicConfig,
  repository: ConversationRepository,
  audit?: AuditWriter
): Promise<TurnProcessor> {
  const { createToolGateway } = await import("../tools/adapters/supabase-adapters");
  const { defaultLanguageService } = await import("../language/language-service");
  const tools = createToolGateway(supabase, config);
  return new TurnProcessor({
    repository,
    tools,
    language: defaultLanguageService,
    audit,
  });
}
