import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildToolRoundLimitFallback } from "../format-ai-state";
import { maybeResetBookingForFreshRequest } from "../booking-reset";
import { shouldSkipDuplicateReply } from "../langgraph/nodes/booking-continuity";
import type { AiConversationState } from "../types";

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
});
