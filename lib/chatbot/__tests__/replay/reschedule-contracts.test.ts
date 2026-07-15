import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveAvailableTools,
  initConversationFlowState,
  syncFlowState,
  completeCurrentOperation,
  resetCurrentOperation,
  hasPendingDeterministicStep,
} from "@/lib/attendance-flow/engine";
import {
  DEFAULT_APPOINTMENT_POLICY,
  DEFAULT_WORKFLOW_REMARCACAO,
} from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import { initialAiState } from "../../state/types";
import { resolveCancelAppointmentId } from "../../state/resolve-cancel-appointment-id";
import { hydrateBookingFromAppointment } from "../../state/hydrate-booking-from-appointment";
import {
  rescheduleNeedsListRule,
  resolveDeterministicActions,
} from "../../agent/deterministic-actions";

const PATIENT = "1679cbdc-f69b-4f99-afb6-72f80caf5a14";
const APPT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPT2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DOCTOR = "82950bcf-2d9d-4760-a9a5-99a315ca3dd9";
const PROCEDURE = "490ed952-9e01-4ff7-b85c-0ab258017fa0";

describe("reschedule replay: engine tools", () => {
  it("exposes list + reschedule when focused and slot ready", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      booking: {
        doctor_id: DOCTOR,
        procedure_id: PROCEDURE,
        pending_slot: "2026-07-20T15:00:00.000Z",
        status: "confirming" as const,
      },
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
    });
    assert.ok(flowState.satisfied.includes("appointment_selected"));
    assert.ok(flowState.satisfied.includes("slot_selected"));

    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(tools.includes("list_patient_appointments"));
    assert.ok(tools.includes("reschedule_appointment"));
    assert.ok(!tools.includes("create_appointment"));
  });
});

describe("reschedule deterministic list", () => {
  it("reschedule without focus → list_patient_appointments", () => {
    const after = {
      ...initialAiState(),
      patient_id: PATIENT,
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        active_workflow_id: "reschedule",
        pending: ["appointment_selected", "slot_selected", "reschedule_booking"],
        focus_goal_id: "appointment_selected",
      },
    };
    assert.equal(rescheduleNeedsListRule.matches({ before: after, after, facts: {} }), true);
    const actions = resolveDeterministicActions({
      before: initialAiState(),
      after,
      facts: {},
    });
    assert.equal(actions[0]!.toolName, "list_patient_appointments");
    assert.equal(actions[0]!.reason, "reschedule_needs_list");
  });

  it("does not list when focused already set", () => {
    const after = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        active_workflow_id: "reschedule",
        pending: ["slot_selected", "reschedule_booking"],
        satisfied: ["appointment_selected"],
      },
    };
    assert.equal(rescheduleNeedsListRule.matches({ before: after, after, facts: {} }), false);
  });
});

describe("hydrateBookingFromAppointment", () => {
  it("sets focus + doctor/procedure collecting", () => {
    const patch = hydrateBookingFromAppointment(
      { id: APPT, doctor_id: DOCTOR, procedure_id: PROCEDURE },
      initialAiState()
    );
    assert.equal(patch.focused_appointment_id, APPT);
    assert.equal(patch.booking?.doctor_id, DOCTOR);
    assert.equal(patch.booking?.procedure_id, PROCEDURE);
    assert.equal(patch.booking?.status, "collecting");
  });
});

describe("completeCurrentOperation after reschedule", () => {
  it("complete: true → status completed + mutation done; sync does not reopen", () => {
    const flow = initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO);
    const next = completeCurrentOperation({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      flowState: flow,
      mutationSucceeded: true,
      complete: true,
    });
    assert.equal(next.current_operation?.status, "completed");
    assert.equal(next.mutation_done?.reschedule_booking, true);
    assert.deepEqual(next.pending, []);

    const synced = syncFlowState({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: {
        ...initialAiState(),
        patient_id: PATIENT,
        focused_appointment_id: APPT,
        conversation_flow: next,
      },
      flowState: next,
    });
    assert.equal(synced.current_operation?.status, "completed");
    assert.deepEqual(synced.pending, []);
    assert.equal(synced.focus_goal_id, undefined);
  });

  it("remainingTargets without complete → reset to active", () => {
    const flow = {
      ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
      mutation_done: { reschedule_booking: true },
      current_operation: { status: "completed" as const },
      satisfied: ["appointment_selected", "slot_selected", "reschedule_booking"],
      pending: [],
    };
    const next = completeCurrentOperation({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      flowState: flow,
      mutationSucceeded: true,
      remainingTargets: [APPT2],
    });
    assert.equal(next.mutation_done?.reschedule_booking, false);
    assert.equal(next.current_operation?.status, "active");

    const synced = syncFlowState({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: {
        ...initialAiState(),
        patient_id: PATIENT,
        active_appointments: [APPT2],
        conversation_flow: next,
      },
      flowState: next,
    });
    assert.ok(synced.pending.includes("appointment_selected"));
    assert.ok(synced.pending.includes("reschedule_booking"));
  });

  it("without remaining → status completed + mutation done", () => {
    const flow = initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO);
    const next = completeCurrentOperation({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      flowState: flow,
      mutationSucceeded: true,
      remainingTargets: [],
    });
    assert.equal(next.mutation_done?.reschedule_booking, true);
    assert.equal(next.current_operation?.status, "completed");
  });

  it("resetCurrentOperation reads runtime.resetSpec and sets active", () => {
    const flow = {
      ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
      mutation_done: { reschedule_booking: true },
      current_operation: { status: "completed" as const },
    };
    const reset = resetCurrentOperation(flow, DEFAULT_WORKFLOW_REMARCACAO);
    assert.equal(reset.mutation_done?.reschedule_booking, false);
    assert.equal(reset.current_operation?.status, "active");
  });

  it("sync does not infer closed from mutation_done alone", () => {
    const flow = {
      ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
      mutation_done: { reschedule_booking: true },
      current_operation: { status: "active" as const },
    };
    const synced = syncFlowState({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: { ...initialAiState(), patient_id: PATIENT, conversation_flow: flow },
      flowState: flow,
    });
    assert.ok(synced.pending.includes("appointment_selected"));
  });
});

describe("resolveCancelAppointmentId for reschedule", () => {
  it("accepts focused appointment", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      active_appointments: [APPT],
    };
    const r = resolveCancelAppointmentId({}, state);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.appointmentId, APPT);
  });
});

describe("hasPendingDeterministicStep (reschedule / post-list)", () => {
  it("true for reschedule mutation pending", () => {
    assert.equal(
      hasPendingDeterministicStep({
        conversation_flow: {
          ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
          pending: ["appointment_selected", "reschedule_booking"],
        },
      }),
      true
    );
  });

  it("true after list (active_appointments) — migration fallback for log case", () => {
    assert.equal(
      hasPendingDeterministicStep({
        active_appointments: [APPT],
      }),
      true
    );
  });

  it("completed operation ignores focus fallback", () => {
    assert.equal(
      hasPendingDeterministicStep({
        focused_appointment_id: APPT,
        active_appointments: [APPT],
        conversation_flow: {
          ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
          current_operation: { status: "completed" },
          pending: [],
          mutation_done: { reschedule_booking: true },
        },
      }),
      false
    );
  });
});
