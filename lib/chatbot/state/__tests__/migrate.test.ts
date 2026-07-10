import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeAiState } from "../migrate";
import { initialAiState } from "../types";

describe("normalizeAiState", () => {
  it("retorna estado inicial para null", () => {
    const state = normalizeAiState(null);
    assert.equal(state.consecutive_tool_failures, 0);
  });

  it("migra campos legados de booking", () => {
    const state = normalizeAiState({
      procedure_id: "proc1",
      doctor_id: "doc1",
      booking_step: "slot",
      offered_slots: [{ scheduled_at: "2026-07-15T10:00:00Z", display: "10:00" }],
    });
    assert.equal(state.booking?.procedure_id, "proc1");
    assert.equal(state.booking?.doctor_id, "doc1");
    assert.equal(state.booking?.offered_slots?.length, 1);
  });
});

describe("initialAiState", () => {
  it("tem consecutive_tool_failures zero", () => {
    assert.equal(initialAiState().consecutive_tool_failures, 0);
  });
});
