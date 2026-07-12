import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveAvailableTools,
  initConversationFlowState,
  syncFlowState,
  resetCurrentCancelOperation,
} from "@/lib/attendance-flow/engine";
import {
  DEFAULT_APPOINTMENT_POLICY,
  DEFAULT_WORKFLOW_CANCELAMENTO,
  DEFAULT_WORKFLOW_CONSULTA,
} from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import { initialAiState } from "../../state/types";
import {
  resolveCancelAppointmentId,
} from "../../state/resolve-cancel-appointment-id";
import { validateToolCall } from "../../guardrails/validators";
import {
  cancelNeedsListRule,
  resolveDeterministicActions,
} from "../../agent/deterministic-actions";
import { resolveReferenceFacts } from "../../state/resolve-facts";

const PATIENT = "1679cbdc-f69b-4f99-afb6-72f80caf5a14";
const APPT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPT2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const APPT3 = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("cancel replay: engine tools", () => {
  it("list stays available when appointment_selected already satisfied", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      booking: { status: "done" as const },
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
    });
    assert.ok(flowState.satisfied.includes("appointment_selected"));
    assert.ok(!flowState.pending.includes("appointment_selected"));

    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(
      tools.includes("list_patient_appointments"),
      `expected list in tools, got: ${tools.join(",")}`
    );
  });

  it("consulta + patient_id allows list_patient_appointments", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA),
    });
    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(
      tools.includes("list_patient_appointments"),
      `expected list on consulta, got: ${tools.join(",")}`
    );
  });

  it("keeps valid focused id (invariant 5 — no wipe required for tools)", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
    });
    assert.equal(aiState.focused_appointment_id, APPT);
    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(tools.includes("list_patient_appointments"));
    assert.ok(tools.includes("cancel_appointment"));
  });
});

describe("cancel deterministic list", () => {
  it("cancelamento without focus → list_patient_appointments", () => {
    const after = {
      ...initialAiState(),
      patient_id: PATIENT,
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
        active_workflow_id: "cancelamento",
        pending: ["appointment_selected", "cancel_reason", "cancel_booking"],
        focus_goal_id: "appointment_selected",
      },
    };
    assert.equal(cancelNeedsListRule.matches({ before: after, after, facts: {} }), true);
    const actions = resolveDeterministicActions({
      before: initialAiState(),
      after,
      facts: {},
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0]!.toolName, "list_patient_appointments");
    assert.equal(actions[0]!.reason, "cancel_needs_list");
  });

  it("does not list when focused already set", () => {
    const after = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
        active_workflow_id: "cancelamento",
        pending: ["cancel_booking"],
        satisfied: ["appointment_selected"],
      },
    };
    assert.equal(cancelNeedsListRule.matches({ before: after, after, facts: {} }), false);
  });
});

describe("appointment index order → focus", () => {
  it("selectedIndex 2 → appointments[1] focused", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      active_appointments: [APPT, APPT2, APPT3],
    };
    const patch = resolveReferenceFacts({ selectedIndex: 2 }, state);
    assert.equal(patch.focused_appointment_id, APPT2);
  });

  it("after focus, cancel_appointment is available", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT2,
      active_appointments: [APPT, APPT2, APPT3],
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
    });
    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(tools.includes("cancel_appointment"));
    const resolved = resolveCancelAppointmentId({}, aiState);
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(resolved.appointmentId, APPT2);
  });
});

describe("Current Operation reset after cancel", () => {
  it("reset clears cancel_reason and reopens goals for next op", () => {
    const flow = {
      ...initConversationFlowState(DEFAULT_WORKFLOW_CANCELAMENTO),
      collected: {
        cancel_reason: "Vou pra outro lugar",
        "custom:cancel_reason": "Vou pra outro lugar",
      },
      mutation_done: { cancel_booking: true },
      satisfied: ["appointment_selected", "cancel_reason", "cancel_booking"],
      pending: [],
    };
    const reset = resetCurrentCancelOperation(flow);
    assert.equal(reset.mutation_done?.cancel_booking, false);
    assert.equal(reset.collected.cancel_reason, undefined);
    assert.equal(reset.collected["custom:cancel_reason"], undefined);

    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      active_appointments: [APPT2, APPT3],
      conversation_flow: reset,
    };
    const synced = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: reset,
    });
    assert.ok(synced.pending.includes("appointment_selected"));
    assert.ok(synced.pending.includes("cancel_reason"));
    assert.ok(synced.pending.includes("cancel_booking"));

    const toolsSelecting = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: { ...aiState, conversation_flow: synced },
      flowState: synced,
    });
    assert.ok(toolsSelecting.includes("list_patient_appointments"));
    // Mutation gated until appointment_selected is satisfied.
    assert.ok(!toolsSelecting.includes("cancel_appointment"));

    const withFocus = {
      ...aiState,
      focused_appointment_id: APPT2,
      conversation_flow: synced,
    };
    const syncedFocused = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: withFocus,
      flowState: synced,
    });
    const toolsReady = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CANCELAMENTO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: { ...withFocus, conversation_flow: syncedFocused },
      flowState: syncedFocused,
    });
    assert.ok(toolsReady.includes("cancel_appointment"));
  });
});

describe("cancel invariants: appointment_id origins", () => {
  it("rejects patient_id as appointment_id", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      active_appointments: [APPT],
    };
    const r = resolveCancelAppointmentId({ appointment_id: PATIENT }, state);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "from_patient_id");
  });

  it("rejects pending_slot ISO as appointment_id", () => {
    const slot = "2026-07-17T13:00:00.000Z";
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      active_appointments: [APPT],
      booking: { pending_slot: slot, status: "done" as const },
    };
    const r = resolveCancelAppointmentId({ appointment_id: slot }, state);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "from_pending_slot");
  });

  it("accepts focused / active domain reference", () => {
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

  it("rejects invented UUID not in focus/active", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      active_appointments: [APPT],
    };
    const r = resolveCancelAppointmentId(
      { appointment_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
      state
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not_domain_reference");
  });

  it("validator blocks patient_id before service", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      active_appointments: [APPT],
    };
    const blocked = validateToolCall(
      "cancel_appointment",
      { appointment_id: PATIENT },
      state,
      {}
    );
    assert.ok(blocked);
    assert.equal(blocked?.status, "needs_input");
  });
});
