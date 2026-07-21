import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAutomation } from "../automation/engine";
import { derivePhaseFromEventTypes, evaluateDomainPolicy } from "../policies/domain";
import { TRANSITION_ALLOWED_COMMANDS } from "../commands";
import { buildWorkspaceContext } from "../context/engine";
import { aiMayPublishEvent, resolveAIPolicy } from "../policies/ai";
import type { JourneyCase } from "../types";

describe("derivePhaseFromEventTypes", () => {
  it("rebuilds phase from atomic events", () => {
    assert.equal(derivePhaseFromEventTypes([]), "captacao");
    assert.equal(derivePhaseFromEventTypes(["Lead.Qualified"]), "comercial");
    assert.equal(
      derivePhaseFromEventTypes(["Lead.Qualified", "Appointment.Created"]),
      "consulta"
    );
    assert.equal(
      derivePhaseFromEventTypes([
        "Lead.Qualified",
        "Appointment.Created",
        "Appointment.Completed",
      ]),
      "financeiro"
    );
    assert.equal(
      derivePhaseFromEventTypes(["Appointment.Completed", "Payment.Paid"]),
      "pos"
    );
  });
});

describe("automation priority", () => {
  it("override exclusive beats lower phase rules", () => {
    const { commands, appliedRuleIds } = runAutomation({
      eventType: "Case.OverrideRequested",
      caseId: "c1",
      currentPhase: "captacao",
      policy: evaluateDomainPolicy({
        eventType: "Case.OverrideRequested",
        currentPhase: "captacao",
      }),
      payload: { target_phase: "financeiro" },
      eventId: "e1",
    });
    assert.ok(appliedRuleIds.includes("override-phase"));
    assert.ok(
      commands.some((c) => c.type === "SetPhase" && c.phase === "financeiro")
    );
  });
});

describe("transition guardrails", () => {
  it("only allows case/task commands", () => {
    assert.ok(TRANSITION_ALLOWED_COMMANDS.has("SetPhase"));
    assert.ok(TRANSITION_ALLOWED_COMMANDS.has("CreateTask"));
    assert.equal(
      (TRANSITION_ALLOWED_COMMANDS as Set<string>).has("CreatePayment"),
      false
    );
  });
});

describe("context engine", () => {
  it("shows finance panels in financeiro phase", () => {
    const c: JourneyCase = {
      id: "1",
      clinic_id: "x",
      contact_id: "lead:1",
      lead_id: "1",
      patient_id: null,
      journey_type: "primeira_consulta",
      phase: "financeiro",
      owner: "system",
      pending_decision: null,
      status: "open",
      opened_at: new Date().toISOString(),
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const ctx = buildWorkspaceContext(c);
    assert.ok(ctx.primaryPanels.includes("financeiro"));
    assert.equal(ctx.derivedObjective, "Receber pagamento");
  });
});

describe("ai policy", () => {
  it("blocks disqualify by default", () => {
    const p = resolveAIPolicy();
    assert.equal(aiMayPublishEvent(p, "Lead.Qualified"), true);
    assert.equal(aiMayPublishEvent(p, "Lead.Disqualified"), false);
  });
});
