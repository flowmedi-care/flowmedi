import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveAvailableTools,
  initConversationFlowState,
  syncFlowState,
} from "@/lib/attendance-flow/engine";
import {
  DEFAULT_APPOINTMENT_POLICY,
  DEFAULT_WORKFLOW_CANCELAMENTO,
} from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import { initialAiState } from "../../state/types";
import {
  resolveCancelAppointmentId,
} from "../../state/resolve-cancel-appointment-id";
import { validateToolCall } from "../../guardrails/validators";

const PATIENT = "1679cbdc-f69b-4f99-afb6-72f80caf5a14";
const APPT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("cancel replay: engine tools", () => {
  it("list stays available when appointment_selected already satisfied", () => {
    // Transcript shape: cancelamento + selection satisfied → list was gated out (bug).
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
