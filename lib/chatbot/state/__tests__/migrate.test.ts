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

  it("preserva offered_days no round-trip", () => {
    const offered_days = [
      { date: "2026-07-15", label: "qua. 15/07", index: 1 },
      { date: "2026-07-20", label: "seg. 20/07", index: 7 },
    ];
    const state = normalizeAiState({
      patient_id: "p1",
      booking: {
        doctor_id: "d1",
        procedure_id: "pr1",
        status: "collecting",
      },
      offered_days,
    });
    assert.equal(state.offered_days?.length, 2);
    assert.equal(state.offered_days?.[1]?.date, "2026-07-20");
    assert.equal(state.offered_days?.[1]?.index, 7);
  });
});

describe("initialAiState", () => {
  it("tem consecutive_tool_failures zero", () => {
    assert.equal(initialAiState().consecutive_tool_failures, 0);
  });
});
