import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daySelectedRule,
  cancelNeedsListRule,
  resolveDeterministicActions,
} from "../deterministic-actions";
import { initialAiState } from "../../state/types";
import { initConversationFlowState } from "@/lib/attendance-flow/engine";
import { DEFAULT_WORKFLOW_CANCELAMENTO } from "@/lib/attendance-flow/defaults";

describe("resolveDeterministicActions / daySelectedRule", () => {
  const doctorId = "82950bcf-2d9d-4760-a9a5-99a315ca3dd9";
  const procedureId = "490ed952-9e01-4ff7-b85c-0ab258017fa0";

  it("emits find_available_slots without period when day just set", () => {
    const before = {
      ...initialAiState(),
      booking: {
        doctor_id: doctorId,
        procedure_id: procedureId,
        status: "collecting" as const,
      },
      offered_days: [{ date: "2026-07-20", label: "seg. 20/07", index: 7 }],
    };
    const after = {
      ...before,
      booking: {
        ...before.booking!,
        date: "2026-07-20",
      },
    };
    const actions = resolveDeterministicActions({
      before,
      after,
      facts: { selectedIndex: 7 },
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0]!.toolName, "find_available_slots");
    assert.equal(actions[0]!.args.date, "2026-07-20");
    assert.equal(actions[0]!.args.period, undefined);
    assert.equal(actions[0]!.reason, "day_selected");
  });

  it("does not match when offered_slots already present", () => {
    const after = {
      ...initialAiState(),
      booking: {
        doctor_id: doctorId,
        procedure_id: procedureId,
        date: "2026-07-20",
        offered_slots: [{ scheduled_at: "2026-07-20T13:00:00Z", display: "10:00" }],
        status: "collecting" as const,
      },
    };
    const before = {
      ...after,
      booking: { ...after.booking!, date: undefined, offered_slots: undefined },
    };
    assert.equal(daySelectedRule.matches({ before, after, facts: {} }), false);
  });

  it("does not match when date unchanged", () => {
    const state = {
      ...initialAiState(),
      booking: {
        doctor_id: doctorId,
        procedure_id: procedureId,
        date: "2026-07-20",
        status: "collecting" as const,
      },
    };
    const actions = resolveDeterministicActions({
      before: state,
      after: state,
      facts: {},
    });
    assert.equal(actions.length, 0);
  });
});

describe("cancelNeedsListRule", () => {
  it("emits list when cancelamento Selecting without focus", () => {
    const after = {
      ...initialAiState(),
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
        pending: ["appointment_selected", "cancel_booking"],
      },
    };
    const actions = resolveDeterministicActions({
      before: initialAiState(),
      after,
      facts: {},
    });
    assert.equal(actions[0]?.toolName, "list_patient_appointments");
    assert.equal(actions[0]?.reason, "cancel_needs_list");
  });

  it("does not match when focused_appointment_id set", () => {
    const after = {
      ...initialAiState(),
      focused_appointment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
        pending: ["cancel_reason", "cancel_booking"],
      },
    };
    assert.equal(cancelNeedsListRule.matches({ before: after, after, facts: {} }), false);
  });

  it("does not match when cancel_booking already satisfied (mutation done)", () => {
    const after = {
      ...initialAiState(),
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
        pending: ["appointment_selected"],
        satisfied: ["cancel_booking"],
        mutation_done: { cancel_booking: true },
      },
    };
    assert.equal(cancelNeedsListRule.matches({ before: after, after, facts: {} }), false);
  });
});
