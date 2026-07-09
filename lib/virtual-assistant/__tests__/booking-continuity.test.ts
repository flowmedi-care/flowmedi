import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectInboundIntent } from "../detect-inbound-intent";
import { routeInboundFlow } from "../intent-router";
import {
  applyBookingContinuityStatePatch,
  hasActiveBookingContext,
  hasOfferedBookingSelection,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "../booking-continuity-guards";
import { resolveDayFromContext } from "../booking-day-context";
import { isFreshBookingRequest, maybeResetBookingForFreshRequest } from "../booking-reset";
import { resolveAgentPipelineStage } from "../agent-pipeline/resolver";
import type { AiConversationState } from "../types";

const bookingState: AiConversationState = {
  intent: "booking",
  booking_step: "day",
  procedure_id: "proc-1",
  doctor_id: "doc-1",
  offered_days: [
    { date: "2026-07-09", label: "qui. 09/07" },
    { date: "2026-07-10", label: "sex. 10/07" },
  ],
};

describe("booking continuity — intent detection", () => {
  it("detecta 'Na sexta de manhã tem quais horários?' como availability_check", () => {
    assert.equal(
      detectInboundIntent("Na sexta de manhã tem quais horários?"),
      "availability_check"
    );
  });

  it("detecta 'De manhã' como availability_check quando booking_step=day", () => {
    assert.equal(detectInboundIntent("De manhã", bookingState), "availability_check");
  });

  it("detecta número da lista quando booking_step=day", () => {
    assert.equal(detectInboundIntent("2", bookingState), "availability_check");
  });
});

describe("booking continuity — flow guards", () => {
  it("hasActiveBookingContext com offered_days", () => {
    assert.equal(hasActiveBookingContext(bookingState), true);
  });

  it("hasOfferedBookingSelection exige proc+médico+dias", () => {
    assert.equal(hasOfferedBookingSelection(bookingState), true);
    assert.equal(
      hasOfferedBookingSelection({ ...bookingState, offered_days: undefined }),
      false
    );
  });

  it("shouldContinueBookingFlow para follow-up de dia sem intent explícito", () => {
    assert.equal(
      shouldContinueBookingFlow(
        "Na sexta de manhã tem quais horários?",
        "availability_check",
        bookingState
      ),
      true
    );
  });

  it("não força booking quando paciente pede valores", () => {
    assert.equal(shouldContinueBookingFlow("Valores", "pricing", bookingState), false);
  });

  it("resolveContinuityIntent mantém pricing explícito fora do booking", () => {
    assert.equal(resolveContinuityIntent("Valores", bookingState, "pricing"), "pricing");
  });

  it("resolveContinuityIntent converte unknown em availability_check no follow-up", () => {
    assert.equal(
      resolveContinuityIntent("De manhã", bookingState, "unknown"),
      "availability_check"
    );
  });

  it("applyBookingContinuityStatePatch define agendamento e booking_step", () => {
    const patched = applyBookingContinuityStatePatch({
      ...bookingState,
      booking_step: undefined,
      pipeline_stage: "captacao",
    });
    assert.equal(patched.intent, "booking");
    assert.equal(patched.booking_step, "day");
    assert.equal(patched.pipeline_stage, "agendamento");
  });
});

describe("booking continuity — routing", () => {
  it("routeInboundFlow ativa máquina de booking com offered_days", () => {
    const routed = routeInboundFlow({
      messageText: "De manhã",
      detectedIntent: "availability_check",
      aiState: bookingState,
    });
    assert.equal(routed.flow, "booking");
    assert.equal(routed.useBookingMachine, true);
  });

  it("resolveAgentPipelineStage retorna agendamento com offered_days", () => {
    const stage = resolveAgentPipelineStage({
      aiState: {
        procedure_id: "proc-1",
        doctor_id: "doc-1",
        offered_days: [{ date: "2026-07-10", label: "sex. 10/07" }],
      },
      journey: null,
      detectedIntent: "unknown",
      routedFlow: "general",
      patientFound: true,
    });
    assert.equal(stage, "agendamento");
  });

  it("Agendar sem booking ativo não ativa continuidade", () => {
    assert.equal(
      shouldContinueBookingFlow("Agendar", "booking", {}),
      false
    );
  });
});

describe("booking reset — stale state", () => {
  const staleState: AiConversationState = {
    intent: "booking",
    booking_step: "confirm",
    procedure_id: "proc-1",
    doctor_id: "doc-1",
    patient_id: "pat-1",
  };

  it("isFreshBookingRequest detecta quero agendar", () => {
    assert.equal(isFreshBookingRequest("Quero agendar"), true);
  });

  it("maybeResetBookingForFreshRequest limpa estado stale", () => {
    const reset = maybeResetBookingForFreshRequest("Quero agendar", staleState, "booking");
    assert.equal(reset.booking_step, "day");
    assert.equal(reset.offered_days, undefined);
    assert.equal(reset.procedure_id, "proc-1");
  });

  it("não reseta quando há offered_days frescos", () => {
    const withDays = {
      ...staleState,
      offered_days: [{ date: "2026-07-10", label: "sex. 10/07" }],
    };
    const kept = maybeResetBookingForFreshRequest("Quero agendar", withDays, "booking");
    assert.equal(kept.booking_step, "confirm");
  });
});

describe("booking day context — last_slot_query", () => {
  it("resolveDayFromContext usa last_slot_query", () => {
    const date = resolveDayFromContext("tarde", {
      last_slot_query: { date: "2026-07-10", period: "manha" },
      procedure_id: "p",
      doctor_id: "d",
    });
    assert.equal(date, "2026-07-10");
  });

  it("resolveDayFromContext extrai sexta da mensagem", () => {
    const date = resolveDayFromContext("Tem disponível na sexta de tarde?", {});
    assert.ok(date);
    assert.match(date!, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("shouldContinueBookingFlow com last_slot_query sem offered_days", () => {
    const ctxState: AiConversationState = {
      intent: "booking",
      booking_step: "day",
      procedure_id: "proc-1",
      doctor_id: "doc-1",
      last_slot_query: { date: "2026-07-10", period: "manha" },
    };
    assert.equal(
      shouldContinueBookingFlow(
        "Tem disponível na sexta de tarde?",
        "unknown",
        ctxState
      ),
      true
    );
  });
});
