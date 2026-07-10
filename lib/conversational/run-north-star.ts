import type { SupabaseClient } from "@supabase/supabase-js";
import { logAiEvent } from "@/lib/virtual-assistant/event-log";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { clinicConfigFromSettings } from "./clinic/clinic-config";
import { createTurnProcessor } from "./conversation/turn-processor";
import { SupabaseConversationRepository } from "./infrastructure/persistence/supabase-conversation-repository";
import {
  northStarFlagsFromSettings,
  shouldRunNorthStar,
} from "./feature-flags";
import { writeDualStateToSupabase, mergeLegacyAiStatePatch } from "./application/legacy-ai-state-adapter";
import type { AiConversationState } from "@/lib/virtual-assistant/types";

export type RunNorthStarInput = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userText: string;
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  faqs?: Array<{ id: string; question: string; answer: string }>;
};

export type RunNorthStarResult = {
  ran: boolean;
  shadow: boolean;
  sendReply: boolean;
  reply?: string;
  silent?: boolean;
  handoff?: boolean;
  fsmStateBefore?: string;
  fsmStateAfter?: string;
  aiStatePatch?: AiConversationState;
};

export async function runNorthStarAssistant(
  input: RunNorthStarInput
): Promise<RunNorthStarResult> {
  const flags = northStarFlagsFromSettings(input.settings);
  const gate = shouldRunNorthStar(flags, input.clinicId);
  if (!gate.run) {
    return { ran: false, shadow: false, sendReply: false };
  }

  const config = clinicConfigFromSettings(input.clinicId, input.settings, input.faqs ?? []);
  const repository = new SupabaseConversationRepository(input.supabase);
  const conversation = await repository.getOrCreate({
    conversationId: input.conversationId,
    clinicId: input.clinicId,
    channel: "whatsapp",
    externalThreadId: input.phoneNumber,
  });

  const audit = async (record: {
    conversationId: string;
    clinicId: string;
    turnId: string;
    fsmStateBefore: string;
    fsmStateAfter: string;
    replyPreview: string;
  }) => {
    logAiEvent(input.supabase, {
      clinicId: record.clinicId,
      conversationId: record.conversationId,
      stage: "north_star_turn",
      detail: {
        turnId: record.turnId,
        fsmStateBefore: record.fsmStateBefore,
        fsmStateAfter: record.fsmStateAfter,
        replyPreview: record.replyPreview,
        shadow: gate.shadow,
      },
    });
  };

  const processor = await createTurnProcessor(input.supabase, config, repository, audit);

  const result = await processor.process(
    conversation,
    {
      conversationId: input.conversationId,
      clinicId: input.clinicId,
      channel: "whatsapp",
      externalThreadId: input.phoneNumber,
      phoneNumber: input.phoneNumber,
      text: input.userText,
    },
    config
  );

  if (result.detectedIntent) {
    logAiEvent(input.supabase, {
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      stage: "intent_classified",
      detail: {
        detected_intent: result.detectedIntent,
        intent_confidence: result.intentConfidence,
        source: "north_star",
        fsmStateBefore: result.fsmStateBefore,
      },
    });
  }

  await writeDualStateToSupabase(
    input.supabase,
    input.conversationId,
    input.aiState,
    result.conversation
  );

  logAiEvent(input.supabase, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    stage: gate.shadow ? "north_star_shadow" : "north_star_complete",
    detail: {
      fsmStateBefore: result.fsmStateBefore,
      fsmStateAfter: result.fsmStateAfter,
      replyPreview: result.reply.slice(0, 120),
      handoff: result.handoff,
      sendReply: gate.sendReply,
    },
  });

  return {
    ran: true,
    shadow: gate.shadow,
    sendReply: gate.sendReply,
    reply: result.reply,
    silent: result.silent,
    handoff: result.handoff,
    fsmStateBefore: result.fsmStateBefore,
    fsmStateAfter: result.fsmStateAfter,
    aiStatePatch: mergeLegacyAiStatePatch(input.aiState, result.conversation),
  };
}
