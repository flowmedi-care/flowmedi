import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCancellationReason, patchStateFromToolResult } from "../validators";

describe("validators cancellation_reason", () => {
  it("parseCancellationReason defaults to other", () => {
    assert.equal(parseCancellationReason(undefined), "other");
    assert.equal(parseCancellationReason("reschedule"), "reschedule");
  });

  it("reschedule routes to agendamento without cancel side effects", () => {
    const patch = patchStateFromToolResult(
      "cancel_appointment",
      { appointment_id: "appt-1", cancellation_reason: "reschedule" },
      { ok: true, reschedule_flow: true },
      {}
    );
    assert.equal(patch.booking_step, "procedure");
    assert.equal(patch.intent, "reschedule");
    assert.equal(patch.pending_reschedule_appointment_id, "appt-1");
  });

  it("dropped clears focus and sets journey step", () => {
    const patch = patchStateFromToolResult(
      "cancel_appointment",
      { appointment_id: "appt-1", cancellation_reason: "dropped" },
      { ok: true },
      { focused_appointment_id: "appt-1" }
    );
    assert.equal(patch.journey_step_code, "consulta_cancelada");
    assert.equal(patch.focused_appointment_id, undefined);
  });
});
