import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveAvailableTools,
  initConversationFlowState,
  syncFlowState,
  completeCurrentOperation,
  canExecuteMutation,
} from "@/lib/attendance-flow/engine";
import {
  DEFAULT_APPOINTMENT_POLICY,
  DEFAULT_WORKFLOW_CHECK_IN,
  mergeAppointmentPolicy,
} from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import { resolveIntent, hasPendingMutationOperation } from "@/lib/attendance-flow/intent-resolver";
import { initialAiState } from "../../state/types";
import {
  checkInNeedsListRule,
  checkInConfirmedRule,
  autoFocusSingleCheckInAppointment,
  resolveDeterministicActions,
} from "../../agent/deterministic-actions";
import { renderMutationSuccess } from "../../tools/render-structured";

const PATIENT = "1679cbdc-f69b-4f99-afb6-72f80caf5a14";
const APPT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const policyEnabled = mergeAppointmentPolicy({
  check_in: { enabled: true },
});

describe("check-in intent", () => {
  it("cheguei → workflow check_in", () => {
    const resolved = resolveIntent({
      userText: "cheguei",
      aiState: initialAiState(),
    });
    assert.equal(resolved.workflow_id, "check_in");
    assert.equal(resolved.reason, "keyword_check_in");
  });

  it("sticky mutation while check_in pending", () => {
    const aiState = {
      ...initialAiState(),
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CHECK_IN),
        pending: ["appointment_selected", "check_in"],
      },
    };
    assert.equal(hasPendingMutationOperation(aiState), true);
  });
});

describe("check-in replay: engine tools", () => {
  it("exposes list + perform_check_in when focused", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CHECK_IN,
      policy: policyEnabled,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CHECK_IN),
    });
    assert.ok(flowState.satisfied.includes("appointment_selected"));
    assert.ok(flowState.pending.includes("check_in"));

    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CHECK_IN,
      policy: policyEnabled,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(tools.includes("list_patient_appointments"));
    assert.ok(tools.includes("perform_check_in"));
    assert.ok(!tools.includes("create_appointment"));
  });

  it("canExecuteMutation check_in requires appointment_selected", () => {
    const gate = canExecuteMutation(
      "check_in",
      "assisted",
      policyEnabled,
      defaultGoalRegistry,
      ["appointment_selected", "check_in"],
      "check_in"
    );
    assert.equal(gate.ok, false);
  });

  it("canExecuteMutation ok when appointment selected", () => {
    const gate = canExecuteMutation(
      "check_in",
      "assisted",
      policyEnabled,
      defaultGoalRegistry,
      ["check_in"],
      "check_in"
    );
    assert.equal(gate.ok, true);
  });
});

describe("check-in deterministic", () => {
  it("without focus → list_patient_appointments", () => {
    const after = {
      ...initialAiState(),
      patient_id: PATIENT,
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CHECK_IN),
        active_workflow_id: "check_in",
        pending: ["appointment_selected", "check_in"],
        focus_goal_id: "appointment_selected",
      },
    };
    assert.equal(checkInNeedsListRule.matches({ before: after, after, facts: {} }), true);
    const actions = resolveDeterministicActions({
      before: initialAiState(),
      after,
      facts: {},
    });
    assert.equal(actions[0]!.toolName, "list_patient_appointments");
    assert.equal(actions[0]!.reason, "check_in_needs_list");
  });

  it("confirmed + focus → perform_check_in", () => {
    const after = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CHECK_IN),
        active_workflow_id: "check_in",
        pending: ["check_in"],
        satisfied: ["appointment_selected"],
      },
    };
    assert.equal(
      checkInConfirmedRule.matches({ before: after, after, facts: { confirmed: true } }),
      true
    );
    const actions = resolveDeterministicActions({
      before: after,
      after,
      facts: { confirmed: true },
    });
    assert.equal(actions[0]!.toolName, "perform_check_in");
  });

  it("autofocus N=1", () => {
    const state = {
      ...initialAiState(),
      active_appointments: [APPT],
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_CHECK_IN),
        pending: ["appointment_selected", "check_in"],
      },
    };
    const next = autoFocusSingleCheckInAppointment(state);
    assert.equal(next.focused_appointment_id, APPT);
  });
});

describe("completeCurrentOperation after check-in", () => {
  it("complete: true → status completed + mutation done; sync does not reopen", () => {
    const flow = initConversationFlowState(DEFAULT_WORKFLOW_CHECK_IN);
    const next = completeCurrentOperation({
      workflow: DEFAULT_WORKFLOW_CHECK_IN,
      flowState: flow,
      mutationSucceeded: true,
      complete: true,
    });
    assert.equal(next.current_operation?.status, "completed");
    assert.equal(next.mutation_done?.check_in, true);
    assert.deepEqual(next.pending, []);

    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      conversation_flow: next,
    };
    const synced = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CHECK_IN,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: next,
    });
    assert.equal(synced.current_operation?.status, "completed");
    assert.deepEqual(synced.pending, []);
  });
});

describe("mutation_success check_in", () => {
  it("renders fixed success copy via mutation key", () => {
    const rendered = renderMutationSuccess({ mutation: "check_in" });
    assert.match(rendered.text, /check-in foi realizado com sucesso/i);
  });
});
