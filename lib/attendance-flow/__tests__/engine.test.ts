import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reevaluateGoals,
  resolveFocusGoal,
  canExecuteMutation,
  initConversationFlowState,
  syncFlowState,
  resolveAvailableTools,
} from "../engine";
import { defaultGoalRegistry } from "../goal-registry";
import {
  DEFAULT_APPOINTMENT_POLICY,
  DEFAULT_WORKFLOW_CONSULTA,
} from "../defaults";
import type { AiState } from "@/lib/chatbot/state/types";

describe("attendance-flow engine", () => {
  it("reevaluateGoals marks multiple goals satisfied from one message state", () => {
    const aiState: AiState = {
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-1",
        pending_slot: "2026-07-17T16:00:00.000Z",
        status: "confirming",
      },
      consecutive_tool_failures: 0,
    };
    const flowState = initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA);

    const result = reevaluateGoals({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });

    assert.ok(result.satisfied.includes("doctor_selected"));
    assert.ok(result.satisfied.includes("procedure_selected"));
    assert.ok(result.satisfied.includes("slot_selected"));
    assert.ok(result.pending.includes("patient_identified"));
  });

  it("resolveFocusGoal picks highest priority pending", () => {
    const goals = defaultGoalRegistry.getForWorkflow(DEFAULT_WORKFLOW_CONSULTA.goal_ids);
    const focus = resolveFocusGoal(
      ["payment_method", "patient_identified", "insurance"],
      goals,
      DEFAULT_WORKFLOW_CONSULTA
    );
    assert.equal(focus, "patient_identified");
  });

  it("canExecuteMutation express allows when core satisfied", () => {
    const pending = ["insurance", "payment_method", "booking_created"];
    const result = canExecuteMutation(
      "booking_created",
      "express",
      DEFAULT_APPOINTMENT_POLICY,
      defaultGoalRegistry,
      pending
    );
    assert.equal(result.ok, true);
  });

  it("canExecuteMutation strict blocks when required pending", () => {
    const pending = ["cpf", "booking_created"];
    const policy = {
      goals: { ...DEFAULT_APPOINTMENT_POLICY.goals, cpf: "required" as const },
    };
    const result = canExecuteMutation(
      "booking_created",
      "strict",
      policy,
      defaultGoalRegistry,
      pending
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.missing.includes("cpf"));
    }
  });

  it("syncFlowState updates focus after satisfaction", () => {
    const aiState: AiState = {
      patient_id: "p-1",
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-1",
        pending_slot: "2026-07-17T16:00:00.000Z",
        status: "confirming",
      },
      consecutive_tool_failures: 0,
    };
    const flowState = initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA);

    const synced = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });

    assert.ok(synced.satisfied.includes("patient_identified"));
    assert.ok(synced.pending.includes("insurance") || synced.pending.includes("booking_created"));
  });

  it("patient cpf satisfies cpf goal via patient_or_collected", () => {
    const aiState: AiState = {
      patient_id: "p-1",
      consecutive_tool_failures: 0,
    };
    const flowState = initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA);
    const result = reevaluateGoals({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
      patient: { cpf: "05126248103", custom_fields: {} },
    });
    assert.ok(result.satisfied.includes("cpf"));
  });

  it("resolveAvailableTools includes create_appointment when core complete", () => {
    const aiState: AiState = {
      patient_id: "p-1",
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-1",
        pending_slot: "2026-07-17T16:00:00.000Z",
        status: "confirming",
      },
      consecutive_tool_failures: 0,
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA),
    });
    const input = {
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    };
    const tools = resolveAvailableTools(input);
    assert.ok(tools.includes("create_appointment"));
  });

  it("resolveAvailableTools excludes intake tools during confirming", () => {
    const aiState: AiState = {
      patient_id: "p-1",
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-1",
        pending_slot: "2026-07-17T16:00:00.000Z",
        status: "confirming",
      },
      consecutive_tool_failures: 0,
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
    assert.ok(tools.includes("create_appointment"));
    assert.ok(!tools.includes("update_patient_intake"));
  });
});

describe("intent-resolver", () => {
  it("detects cancelamento", async () => {
    const { resolveIntent } = await import("../intent-resolver");
    const r = resolveIntent({
      userText: "Quero cancelar minha consulta",
      aiState: { consecutive_tool_failures: 0 },
    });
    assert.equal(r.workflow_id, "cancelamento");
  });

  it("detects booking keywords", async () => {
    const { resolveIntent } = await import("../intent-resolver");
    const r = resolveIntent({
      userText: "Quero marcar uma consulta",
      aiState: { consecutive_tool_failures: 0 },
    });
    assert.equal(r.workflow_id, "consulta");
  });
});
