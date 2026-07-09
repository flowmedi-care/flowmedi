import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildToolRoundLimitFallback } from "../format-ai-state";
import { maybeResetBookingForFreshRequest } from "../booking-reset";
import { shouldSkipDuplicateReply, isProcessingLockActive } from "../langgraph/nodes/booking-continuity";
import { deterministicRouterNode } from "../langgraph/nodes/deterministic-router";
import { resolveAgentPipelineStage } from "../agent-pipeline/resolver";
import { detectInboundIntent } from "../detect-inbound-intent";
import { CAPTACAO_GREETING_MENU } from "../langgraph/trace";
import type { AiConversationState } from "../types";
import type { GraphState } from "../langgraph/state";

function baseGraphState(overrides: Partial<GraphState> = {}): GraphState {
  return {
    inboundText: "Oi",
    userMessages: ["Oi"],
    history: [],
    aiState: {},
    detectedIntent: "greeting",
    classifiedIntent: null,
    intentConfidence: 0.95,
    entities: {},
    missingSlots: [],
    routedFlow: "general",
    pipelineStage: "captacao",
    parallelStages: [],
    allowedTools: [],
    reply: null,
    handoff: false,
    stageSubgraphComplete: false,
    needsHumanConfirm: false,
    needsToolLoop: false,
    clinicDataText: "",
    journeyBlock: "",
    patientBootstrap: "",
    runtimeContext: null,
    replySource: null,
    hadReplyBeforeCompose: false,
    assistantRoute: "agent",
    routeSource: "regex",
    ...overrides,
  };
}

describe("langgraph subgraphs — conversation regressions", () => {
  it("Quero agendar com state stale não retorna fallback de confirmar horário", () => {
    const stale: AiConversationState = {
      intent: "booking",
      booking_step: "confirm",
      procedure_id: "proc-1",
      doctor_id: "doc-1",
    };
    const reset = maybeResetBookingForFreshRequest("Quero agendar", stale, "booking");
    const fallback = buildToolRoundLimitFallback({ ...reset, intent: "booking" });
    assert.doesNotMatch(fallback, /Falta só confirmar o horário/);
  });

  it("dedupe evita mesma resposta em 30s", () => {
    const id = "conv-test-dedupe";
    const ids = ["m1"];
    const reply = "Não há horários na manhã de sexta.";
    assert.equal(shouldSkipDuplicateReply(id, ids, reply), false);
    assert.equal(shouldSkipDuplicateReply(id, ids, reply), true);
  });

  it("lock expira após maxAgeMs", () => {
    const stale = {
      ai_processing_started_at: new Date(Date.now() - 120_000).toISOString(),
    };
    assert.equal(isProcessingLockActive(stale), false);
    const fresh = { ai_processing_started_at: new Date().toISOString() };
    assert.equal(isProcessingLockActive(fresh), true);
  });
});

describe("langgraph — deterministic router", () => {
  it("Oi → menu captação determinístico (sem saudação genérica LLM)", async () => {
    const result = await deterministicRouterNode(
      baseGraphState({
        inboundText: "Oi",
        detectedIntent: "greeting",
        pipelineStage: "identificacao",
      })
    );
    assert.ok(result.reply?.includes("1. Agendar consulta"));
    assert.equal(result.reply, CAPTACAO_GREETING_MENU);
    assert.doesNotMatch(result.reply ?? "", /Como posso ajudar você hoje/);
    assert.equal(result.replySource, "deterministic");
    assert.equal(result.stageSubgraphComplete, true);
  });

  it("não sobrescreve reply existente do subgrafo", async () => {
    const result = await deterministicRouterNode(
      baseGraphState({
        reply: "Resposta do subgrafo",
        replySource: "subgraph",
      })
    );
    assert.deepEqual(result, {});
  });
});

describe("langgraph — resolver booking vs identificacao", () => {
  it("Quero agendar com pipeline_stage identificacao → agendamento", () => {
    assert.equal(detectInboundIntent("Quero agendar"), "booking");
    const stage = resolveAgentPipelineStage({
      aiState: { pipeline_stage: "identificacao" },
      journey: null,
      detectedIntent: "booking",
      routedFlow: "booking",
      patientFound: false,
    });
    assert.equal(stage, "agendamento");
  });

  it("identificacao + patient_id → captacao (sem booking intent)", () => {
    const stage = resolveAgentPipelineStage({
      aiState: { pipeline_stage: "identificacao", patient_id: "pat-1" },
      journey: null,
      detectedIntent: "unknown",
      routedFlow: "general",
      patientFound: true,
    });
    assert.equal(stage, "captacao");
  });

  it("Quero agendar fallback não é saudação genérica", () => {
    const fallback = buildToolRoundLimitFallback({
      intent: "booking",
      booking_step: "procedure",
    });
    assert.doesNotMatch(fallback, /Como posso ajudar você hoje/);
    assert.match(fallback, /procedimento|consulta/i);
  });
});
