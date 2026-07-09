import {
  detectInboundIntent,
  hasClearIntent,
  intentToAiStatePatch,
} from "../../detect-inbound-intent";
import {
  applyBookingContinuityStatePatch,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "../../booking-continuity-guards";
import { createChatCompletion } from "../../openai-client";
import { logAiEvent } from "../../event-log";
import type { GraphState } from "../state";
import { logLangGraphTrace } from "../trace";
import {
  ClassifiedIntentSchema,
  CLASSIFY_INTENT_SYSTEM,
  inboundIntentFromClassification,
  type ClassifiedIntent,
} from "../intent-schema";

const FAST_PATH_INTENTS = new Set([
  "greeting",
  "human_handoff",
  "reschedule",
  "cancel",
  "payment",
  "form",
  "quote",
  "my_appointments",
  "availability_check",
]);

function buildFastPathClassification(
  text: string,
  regexIntent: ReturnType<typeof detectInboundIntent>
): ClassifiedIntent | null {
  if (!FAST_PATH_INTENTS.has(regexIntent) && regexIntent !== "booking" && regexIntent !== "pricing") {
    return null;
  }

  const missing_slots: string[] = [];
  if (regexIntent === "availability_check" || regexIntent === "booking") {
    missing_slots.push("procedure", "doctor");
  }

  return {
    intent: regexIntent === "unknown" ? "general" : regexIntent,
    confidence: regexIntent === "unknown" ? 0.3 : 0.95,
    entities: {},
    missing_slots,
  };
}

async function classifyWithLlm(
  text: string,
  model: string
): Promise<ClassifiedIntent> {
  const completion = await createChatCompletion({
    model,
    messages: [
      { role: "system", content: CLASSIFY_INTENT_SYSTEM },
      {
        role: "user",
        content: `Mensagem do paciente:\n${text}\n\nResponda APENAS com JSON válido.`,
      },
    ],
    temperature: 0,
    maxTokens: 300,
  });

  const raw = completion.content?.trim() ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? raw);
  return ClassifiedIntentSchema.parse(parsed);
}

function logIntentClassified(
  state: GraphState,
  detail: {
    detected_intent: string;
    intent_confidence: number;
    source: "continuity" | "regex_fast_path" | "llm";
    continuity_intent?: string;
    used_llm?: boolean;
  }
): void {
  const ctx = state.runtimeContext;
  if (!ctx) return;

  logAiEvent(ctx.supabase, {
    clinicId: ctx.clinicId,
    conversationId: ctx.conversationId,
    stage: "intent_classified",
    detail: {
      ...detail,
      inbound_text: state.inboundText.slice(0, 500),
      booking_step_before: state.aiState.booking_step ?? null,
      pipeline_stage_before: state.aiState.pipeline_stage ?? null,
      offered_slots_count: state.aiState.offered_slots?.length ?? 0,
    },
  });

  logLangGraphTrace(ctx.supabase, ctx.clinicId, ctx.conversationId, {
    node: "classify_intent",
    detected_intent: detail.detected_intent as GraphState["detectedIntent"],
    intent_confidence: detail.intent_confidence,
    used_llm: detail.used_llm,
    continuity_intent: detail.continuity_intent as GraphState["detectedIntent"],
    inbound_preview: state.inboundText.slice(0, 80),
  });
}

export async function classifyIntentNode(state: GraphState): Promise<Partial<GraphState>> {
  const text = state.inboundText.trim();
  const model = state.runtimeContext?.settings.ai_model ?? "gpt-4o-mini";
  const regexIntent = detectInboundIntent(text, state.aiState);
  const continuityIntent = resolveContinuityIntent(text, state.aiState, regexIntent);

  if (shouldContinueBookingFlow(text, continuityIntent, state.aiState)) {
    const aiState = applyBookingContinuityStatePatch(state.aiState);
    const detectedIntent =
      continuityIntent === "availability_check" ? "availability_check" : "booking";
    logIntentClassified(state, {
      detected_intent: detectedIntent,
      intent_confidence: 0.98,
      source: "continuity",
      continuity_intent: continuityIntent,
    });
    return {
      classifiedIntent: {
        intent: detectedIntent,
        confidence: 0.98,
        entities: {},
        missing_slots: [],
      },
      detectedIntent,
      intentConfidence: 0.98,
      entities: {},
      missingSlots: [],
      aiState,
    };
  }

  let classified = buildFastPathClassification(text, regexIntent);
  let usedLlm = false;

  if (!classified) {
    usedLlm = true;
    try {
      classified = await classifyWithLlm(text, model);
    } catch (e) {
      console.warn("[LangGraph] classify LLM fallback:", e);
      classified = {
        intent: regexIntent === "unknown" ? "general" : regexIntent,
        confidence: 0.5,
        entities: {},
        missing_slots: [],
      };
    }
  }

  const detectedIntent = inboundIntentFromClassification(classified);
  let aiState = { ...state.aiState };

  if (hasClearIntent(detectedIntent) && !aiState.intent && !aiState.booking_step) {
    aiState = { ...aiState, ...intentToAiStatePatch(detectedIntent) };
  }

  if (
    (detectedIntent === "booking" || detectedIntent === "availability_check") &&
    !aiState.booking_step
  ) {
    aiState = { ...aiState, booking_step: "procedure", intent: "booking" };
  }

  logIntentClassified(state, {
    detected_intent: detectedIntent,
    intent_confidence: classified.confidence,
    source: usedLlm ? "llm" : "regex_fast_path",
    used_llm: usedLlm,
  });

  return {
    classifiedIntent: classified,
    detectedIntent,
    intentConfidence: classified.confidence,
    entities: classified.entities,
    missingSlots: classified.missing_slots,
    aiState,
  };
}
