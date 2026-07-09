import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectInboundIntent } from "../../detect-inbound-intent";
import { resolveAgentPipelineStage } from "../../agent-pipeline/resolver";
import { routeInboundFlow } from "../../intent-router";
import { ClassifiedIntentSchema } from "../intent-schema";
import { resetCheckpointerForTests } from "../checkpointer";

describe("LangGraph intent — availability_check", () => {
  it("detecta 'tem horário semana que vem' como availability_check", () => {
    const intent = detectInboundIntent("tem horário semana que vem?");
    assert.equal(intent, "availability_check");
  });

  it("não confunde horário de funcionamento com availability", () => {
    const intent = detectInboundIntent("vocês abrem sábado?");
    assert.equal(intent, "hours_location");
  });

  it("roteia availability_check para booking com máquina ativa", () => {
    const routed = routeInboundFlow({
      messageText: "tem horário semana que vem?",
      detectedIntent: "availability_check",
      aiState: {},
    });
    assert.equal(routed.flow, "booking");
    assert.equal(routed.useBookingMachine, true);
  });

  it("resolve estágio agendamento para availability_check", () => {
    const stage = resolveAgentPipelineStage({
      aiState: { booking_step: "procedure", intent: "booking" },
      journey: null,
      detectedIntent: "availability_check",
      routedFlow: "booking",
      patientFound: true,
    });
    assert.equal(stage, "agendamento");
  });
});

describe("LangGraph intent schema", () => {
  it("valida classificação estruturada", () => {
    const parsed = ClassifiedIntentSchema.parse({
      intent: "availability_check",
      confidence: 0.9,
      entities: { time_reference: "semana que vem" },
      missing_slots: ["procedure", "doctor"],
    });
    assert.equal(parsed.intent, "availability_check");
    assert.deepEqual(parsed.missing_slots, ["procedure", "doctor"]);
  });
});

describe("LangGraph graph reset", () => {
  it("permite reset do checkpointer para testes", () => {
    resetCheckpointerForTests();
    assert.ok(true);
  });
});

describe("LangGraph intent — outros cenários", () => {
  it("detecta handoff explícito", () => {
    assert.equal(detectInboundIntent("quero falar com atendente"), "human_handoff");
  });

  it("resolve remarcar para confirmacao_pre_consulta ou agendamento", () => {
    const stage = resolveAgentPipelineStage({
      aiState: {},
      journey: null,
      detectedIntent: "reschedule",
      routedFlow: "booking",
      patientFound: true,
    });
    assert.equal(stage, "agendamento");
  });

  it("resolve pricing para orcamento", () => {
    const stage = resolveAgentPipelineStage({
      aiState: {},
      journey: null,
      detectedIntent: "pricing",
      routedFlow: "pricing",
      patientFound: true,
    });
    assert.equal(stage, "orcamento");
  });
});
