import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFacts } from "../../extractors";
import { resolveReferenceFacts, applySemanticFacts } from "../resolve-facts";
import { initialAiState } from "../types";
import {
  resolveAvailableTools,
  syncFlowState,
  initConversationFlowState,
} from "@/lib/attendance-flow/engine";
import {
  DEFAULT_APPOINTMENT_POLICY,
  DEFAULT_WORKFLOW_CONSULTA,
} from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";

describe("booking matrix: 10:00 then create_appointment gate", () => {
  it("extracts 10:00 into pending_slot and unlocks create_appointment", () => {
    const offered = [
      { scheduled_at: "2026-07-15T11:00:00.000Z", display: "08:00" },
      { scheduled_at: "2026-07-15T13:00:00.000Z", display: "10:00" },
      { scheduled_at: "2026-07-15T13:30:00.000Z", display: "10:30" },
    ];

    const before = {
      ...initialAiState(),
      patient_id: "p-1",
      offered_doctors: [
        { id: "dr-1", name: "Daniel", index: 1 },
      ],
      offered_procedures: [
        { id: "proc-endo", name: "Endoscopia", index: 1 },
      ],
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-endo",
        date: "2026-07-15",
        offered_slots: offered,
        status: "collecting" as const,
      },
    };

    const facts = extractFacts("10:00", new Date(), offered);
    assert.equal(facts.selected_scheduled_at, "2026-07-15T13:00:00.000Z");

    const patch = applySemanticFacts(facts, before);
    assert.equal(patch.booking?.pending_slot, "2026-07-15T13:00:00.000Z");
    assert.equal(patch.booking?.status, "confirming");

    const after = {
      ...before,
      booking: { ...before.booking, ...patch.booking },
    };

    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: after,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA),
    });

    assert.ok(flowState.satisfied.includes("slot_selected"));
    assert.ok(!flowState.pending.includes("slot_selected"));

    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState: after,
      flowState,
    });
    assert.ok(tools.includes("create_appointment"));
  });

  it("does not unlock create_appointment on Sim without pending_slot", () => {
    const aiState = {
      ...initialAiState(),
      patient_id: "p-1",
      booking: {
        doctor_id: "dr-1",
        procedure_id: "proc-endo",
        date: "2026-07-15",
        offered_slots: [
          { scheduled_at: "2026-07-15T13:00:00.000Z", display: "10:00" },
        ],
        status: "collecting" as const,
      },
    };

    const facts = extractFacts("Sim", new Date(), aiState.booking.offered_slots);
    assert.equal(facts.confirmed, true);
    assert.equal(facts.selected_scheduled_at, undefined);

    const patch = resolveReferenceFacts(facts, aiState);
    assert.equal(patch.booking?.pending_slot, undefined);

    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_CONSULTA),
    });
    assert.ok(flowState.pending.includes("slot_selected"));

    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_CONSULTA,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(!tools.includes("create_appointment"));
  });
});
