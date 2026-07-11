import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { ConversationSnapshot } from "../conversation-snapshot";
import type { NormalizedFacts } from "../extractors/types";
import type { ExecutionTrace } from "../observability/execution-trace";
import type { TurnTrace } from "../observability/turn-trace";
import type { AiState } from "../state/types";
import type { FaqItem } from "../tools/types";
import type { ChatMessage } from "./llm";

export type TurnContext = {
  conversation: {
    id: string;
    clinicId: string;
    phoneNumber: string;
    patientId: string | null;
  };
  snapshot: ConversationSnapshot;
  aiState: AiState;
  clinic: {
    name: string;
    settings: Partial<VirtualAssistantSettings>;
    faqs: FaqItem[];
  };
  messages: ChatMessage[];
  turnFacts: NormalizedFacts & Record<string, unknown>;
  trace: TurnTrace;
  executionTraces: ExecutionTrace[];
};

export function createTurnContext(input: {
  conversationId: string;
  clinicId: string;
  phoneNumber: string;
  patientId: string | null;
  snapshot: ConversationSnapshot;
  aiState: AiState;
  clinicName: string;
  settings: Partial<VirtualAssistantSettings>;
  faqs: FaqItem[];
  messages: ChatMessage[];
  turnFacts: NormalizedFacts & Record<string, unknown>;
  trace: TurnTrace;
}): TurnContext {
  return {
    conversation: {
      id: input.conversationId,
      clinicId: input.clinicId,
      phoneNumber: input.phoneNumber,
      patientId: input.patientId,
    },
    snapshot: input.snapshot,
    aiState: input.aiState,
    clinic: {
      name: input.clinicName,
      settings: input.settings,
      faqs: input.faqs,
    },
    messages: input.messages,
    turnFacts: input.turnFacts,
    trace: input.trace,
    executionTraces: input.trace.executionTraces,
  };
}
