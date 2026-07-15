import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daySelectedRule,
  cancelNeedsListRule,
  rescheduleNeedsListRule,
  rescheduleSlotConfirmedRule,
  autoFocusSingleRescheduleAppointment,
  resolveDeterministicActions,
} from "../deterministic-actions";
import { initialAiState } from "../../state/types";
import { initConversationFlowState } from "@/lib/attendance-flow/engine";
import {
  DEFAULT_WORKFLOW_CANCELAMENTO,
  DEFAULT_WORKFLOW_REMARCACAO,
} from "@/lib/attendance-flow/defaults";

const APPT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPT2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

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

describe("rescheduleNeedsListRule", () => {
  it("emits list when reschedule Selecting without focus", () => {
    const after = {
      ...initialAiState(),
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["appointment_selected", "reschedule_booking"],
      },
    };
    const actions = resolveDeterministicActions({
      before: initialAiState(),
      after,
      facts: {},
    });
    assert.equal(actions[0]?.toolName, "list_patient_appointments");
    assert.equal(actions[0]?.reason, "reschedule_needs_list");
  });

  it("does not match when focused_appointment_id set", () => {
    const after = {
      ...initialAiState(),
      focused_appointment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["slot_selected", "reschedule_booking"],
      },
    };
    assert.equal(rescheduleNeedsListRule.matches({ before: after, after, facts: {} }), false);
  });
});

describe("rescheduleSlotConfirmedRule", () => {
  it("emits reschedule_appointment on confirmed + pending_slot + focus", () => {
    const after = {
      ...initialAiState(),
      focused_appointment_id: APPT,
      booking: {
        pending_slot: "2026-07-17T13:00:00.000Z",
        status: "confirming" as const,
      },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["reschedule_booking"],
        satisfied: ["appointment_selected", "slot_selected"],
      },
    };
    assert.equal(
      rescheduleSlotConfirmedRule.matches({
        before: after,
        after,
        facts: { confirmed: true },
      }),
      true
    );
    const actions = resolveDeterministicActions({
      before: after,
      after,
      facts: { confirmed: true },
    });
    assert.equal(actions[0]?.toolName, "reschedule_appointment");
    assert.equal(actions[0]?.args.new_scheduled_at, "2026-07-17T13:00:00.000Z");
    assert.equal(actions[0]?.args.appointment_id, APPT);
  });

  it("does not match when operation completed", () => {
    const after = {
      ...initialAiState(),
      focused_appointment_id: APPT,
      booking: {
        pending_slot: "2026-07-17T13:00:00.000Z",
        status: "confirming" as const,
      },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        current_operation: { status: "completed" as const },
        pending: [],
        mutation_done: { reschedule_booking: true },
      },
    };
    assert.equal(
      rescheduleSlotConfirmedRule.matches({
        before: after,
        after,
        facts: { confirmed: true },
      }),
      false
    );
  });
});

describe("autoFocusSingleRescheduleAppointment", () => {
  it("focuses when N=1, !focus, reschedule, mutation pending", () => {
    const state = {
      ...initialAiState(),
      active_appointments: [APPT],
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["appointment_selected", "reschedule_booking"],
      },
    };
    const next = autoFocusSingleRescheduleAppointment(state);
    assert.equal(next.focused_appointment_id, APPT);
  });

  it("does not focus when N>1", () => {
    const state = {
      ...initialAiState(),
      active_appointments: [APPT, APPT2],
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["appointment_selected", "reschedule_booking"],
      },
    };
    assert.equal(autoFocusSingleRescheduleAppointment(state).focused_appointment_id, undefined);
  });

  it("does not focus when already focused", () => {
    const state = {
      ...initialAiState(),
      focused_appointment_id: APPT,
      active_appointments: [APPT],
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["slot_selected", "reschedule_booking"],
      },
    };
    assert.equal(autoFocusSingleRescheduleAppointment(state).focused_appointment_id, APPT);
  });
});
