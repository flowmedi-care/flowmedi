import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pendingToNextDecision,
  nextDecisionToPending,
  waitingForToDecider,
  actionGroupLabel,
} from "../next-decision";

describe("NextDecision adapters", () => {
  it("maps pending_decision to NextDecision", () => {
    const next = pendingToNextDecision({
      type: "confirm_slot",
      waiting_for: "patient",
      label: "Confirmar consulta",
      due_at: null,
    });
    assert.ok(next);
    assert.equal(next!.action, "confirm_slot");
    assert.equal(next!.decider, "patient");
    assert.equal(next!.label, "Confirmar consulta");
  });

  it("round-trips human decision", () => {
    const next = pendingToNextDecision({
      type: "advance_commercial",
      waiting_for: "secretaria",
      label: "Agendar",
    });
    assert.ok(next);
    const pending = nextDecisionToPending(next!);
    assert.equal(pending.type, "advance_commercial");
    assert.equal(pending.waiting_for, "secretaria");
    assert.equal(waitingForToDecider(pending.waiting_for), "human");
  });

  it("actionGroupLabel for CTAs", () => {
    assert.equal(actionGroupLabel("confirm_slot"), "Confirmar consultas");
  });
});
