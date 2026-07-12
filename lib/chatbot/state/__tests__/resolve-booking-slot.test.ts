import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isScheduledAtInOfferedSlots,
  schedulesMatchForBooking,
} from "@/lib/booking-state";
import { resolveCreateAppointmentScheduledAt } from "../patch";
import { validateToolCall } from "@/lib/chatbot/guardrails/validators";
import type { AiState } from "../types";

const OFFERED = [
  { scheduled_at: "2026-07-15T11:00:00.000Z", display: "08:00" },
  { scheduled_at: "2026-07-15T11:30:00.000Z", display: "08:30" },
  { scheduled_at: "2026-07-15T12:00:00.000Z", display: "09:00" },
];

function stateWithPending(pending: string): AiState {
  return {
    consecutive_tool_failures: 0,
    patient_id: "f2ed8c79-53e9-4fae-aa2c-96a0ee30cedf",
    booking: {
      doctor_id: "82950bcf-2d9d-4760-a9a5-99a315ca3dd9",
      procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0",
      offered_slots: OFFERED,
      pending_slot: pending,
      status: "confirming",
    },
  };
}

describe("schedulesMatchForBooking", () => {
  it("matches exact ISO", () => {
    assert.equal(
      schedulesMatchForBooking(
        "2026-07-15T12:00:00.000Z",
        "2026-07-15T12:00:00.000Z"
      ),
      true
    );
  });

  it("matches ISO without milliseconds", () => {
    assert.equal(
      isScheduledAtInOfferedSlots("2026-07-15T12:00:00Z", OFFERED),
      true
    );
  });
});

describe("resolveCreateAppointmentScheduledAt", () => {
  it("prefers pending_slot when confirmed and LLM scheduled_at is wrong", () => {
    const state = stateWithPending("2026-07-15T12:00:00.000Z");
    const resolved = resolveCreateAppointmentScheduledAt(
      { scheduled_at: "2026-07-15T09:00:00.000Z" },
      state,
      { confirmed: true }
    );
    assert.equal(resolved, "2026-07-15T12:00:00.000Z");
  });

  it("uses valid args scheduled_at when no pending", () => {
    const state: AiState = {
      consecutive_tool_failures: 0,
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-1",
        offered_slots: OFFERED,
        status: "confirming",
      },
    };
    const resolved = resolveCreateAppointmentScheduledAt(
      { scheduled_at: "2026-07-15T12:00:00.000Z" },
      state
    );
    assert.equal(resolved, "2026-07-15T12:00:00.000Z");
  });

  it("prefers pending_slot when args not in offered list", () => {
    const state = stateWithPending("2026-07-15T12:00:00.000Z");
    const resolved = resolveCreateAppointmentScheduledAt(
      { scheduled_at: "2026-07-15T09:00:00.000Z" },
      state
    );
    assert.equal(resolved, "2026-07-15T12:00:00.000Z");
  });
});

describe("validateToolCall create_appointment", () => {
  it("passes when Sim confirmed with wrong LLM scheduled_at but valid pending_slot", () => {
    const state = stateWithPending("2026-07-15T12:00:00.000Z");
    const result = validateToolCall(
      "create_appointment",
      {
        patient_id: "f2ed8c79-53e9-4fae-aa2c-96a0ee30cedf",
        doctor_id: "82950bcf-2d9d-4760-a9a5-99a315ca3dd9",
        procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0",
        scheduled_at: "2026-07-15T09:00:00.000Z",
      },
      state,
      {},
      { confirmed: true }
    );
    assert.equal(result, null);
  });
});
