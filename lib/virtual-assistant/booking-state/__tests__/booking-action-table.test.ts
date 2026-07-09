import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveBookingAction,
  shouldBlockBookingToolLoop,
} from "../booking-action-table";

describe("booking-action-table", () => {
  it("blocks tool loop when offered slots are active", () => {
    assert.equal(
      shouldBlockBookingToolLoop({
        offered_slots: [{ scheduled_at: "2026-07-10T15:30:00Z", display: "15:30" }],
      }),
      true
    );
  });

  it("returns invalid_slot_reply for bad selection with offered slots", () => {
    const action = resolveBookingAction({
      aiState: {
        booking_step: "procedure",
        offered_slots: [{ scheduled_at: "2026-07-10T15:30:00Z", display: "15:30" }],
        procedure_id: "p1",
        doctor_id: "d1",
      },
      inboundText: "99",
      detectedIntent: "booking",
    });
    assert.equal(action.type, "invalid_slot_reply");
  });

  it("returns list_procedures when procedure missing", () => {
    const action = resolveBookingAction({
      aiState: { booking_step: "procedure" },
      inboundText: "continuar",
      detectedIntent: "booking",
    });
    assert.equal(action.type, "list_procedures");
  });
});
