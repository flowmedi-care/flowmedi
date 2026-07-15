import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeStaleBooking } from "../sanitize-stale-booking";
import { initialAiState } from "../types";

describe("sanitizeStaleBooking", () => {
  it("clears date, slots, pending_slot when date is before today", () => {
    const state = {
      ...initialAiState(),
      booking: {
        doctor_id: "d1",
        procedure_id: "p1",
        date: "2026-07-13",
        pending_slot: "2026-07-13T12:30:00.000Z",
        offered_slots: [{ scheduled_at: "2026-07-13T12:30:00.000Z", display: "09:30" }],
        status: "confirming" as const,
      },
    };
    const next = sanitizeStaleBooking(state, new Date("2026-07-15T12:00:00.000Z"));
    assert.equal(next.booking?.date, undefined);
    assert.equal(next.booking?.pending_slot, undefined);
    assert.equal(next.booking?.offered_slots, undefined);
    assert.equal(next.booking?.doctor_id, "d1");
    assert.equal(next.booking?.procedure_id, "p1");
    assert.equal(next.booking?.status, "collecting");
  });

  it("keeps booking when date is today or future", () => {
    const state = {
      ...initialAiState(),
      booking: {
        date: "2026-07-17",
        status: "confirming" as const,
        pending_slot: "2026-07-17T13:00:00.000Z",
      },
    };
    const next = sanitizeStaleBooking(state, new Date("2026-07-15T12:00:00.000Z"));
    assert.equal(next.booking?.date, "2026-07-17");
    assert.equal(next.booking?.pending_slot, "2026-07-17T13:00:00.000Z");
  });
});
