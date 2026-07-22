import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveNextAction,
  caseRequiresHumanNextAction,
  pendingRequiresHumanDecision,
} from "../next-action";

describe("resolveNextAction (pure)", () => {
  it("prefers pending_decision", () => {
    const next = resolveNextAction(
      {
        pending_decision: {
          type: "confirm_appointment",
          waiting_for: "secretaria",
          label: "Confirmar consulta de Ana",
          due_at: "2026-07-22T15:00:00Z",
        },
      },
      [{ title: "Task", status: "open", due_at: null, assignee_role: "secretaria" }],
      { id: "a1", scheduledAt: "2026-07-22T15:00:00Z", status: "agendada" }
    );
    assert.equal(next?.source, "pending_decision");
    assert.equal(next?.label, "Confirmar consulta de Ana");
  });

  it("falls back to open task", () => {
    const next = resolveNextAction({ pending_decision: null }, [
      { title: "Ligar paciente", status: "open", due_at: "2026-07-23", assignee_role: "secretaria" },
    ]);
    assert.equal(next?.source, "task");
    assert.equal(next?.label, "Ligar paciente");
  });

  it("falls back to appointment needing confirm", () => {
    const next = resolveNextAction({ pending_decision: null }, [], {
      id: "a1",
      scheduledAt: "2026-07-22T15:00:00Z",
      status: "agendada",
    });
    assert.equal(next?.source, "appointment");
    assert.equal(next?.appointmentId, "a1");
  });

  it("pendingRequiresHumanDecision", () => {
    assert.equal(
      pendingRequiresHumanDecision({
        type: "x",
        waiting_for: "secretaria",
        label: "x",
      }),
      true
    );
    assert.equal(
      pendingRequiresHumanDecision({
        type: "x",
        waiting_for: "patient",
        label: "x",
      }),
      false
    );
  });

  it("caseRequiresHumanNextAction", () => {
    assert.equal(
      caseRequiresHumanNextAction({
        pending_decision: {
          type: "x",
          waiting_for: "secretaria",
          label: "Decide",
        },
      }),
      true
    );
  });
});
