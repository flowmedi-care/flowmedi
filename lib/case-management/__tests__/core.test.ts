import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAutomation } from "../automation/engine";
import { commandKey } from "../apply-commands";
import { derivePhaseFromEventTypes, evaluateDomainPolicy } from "../policies/domain";
import { TRANSITION_ALLOWED_COMMANDS } from "../commands";
import {
  derivedObjectiveForPhase,
  panelsForPhaseCode,
} from "../context/engine";
import {
  aiMayPublishEvent,
  resolveAIPolicy,
} from "../policies/ai";
import { resolveClinicPolicy } from "../policies/clinic";
import {
  isDomainFactBlockedForAi,
  isAiIntentEvent,
} from "../events";
import type { CaseCommand } from "../commands";

const clinic = resolveClinicPolicy();

describe("derivePhaseFromEventTypes", () => {
  it("rebuilds phase from atomic events", () => {
    assert.equal(derivePhaseFromEventTypes([]), "captacao");
    assert.equal(derivePhaseFromEventTypes(["Lead.Qualified"]), "comercial");
    assert.equal(
      derivePhaseFromEventTypes(["Lead.Qualified", "Appointment.Created"]),
      "consulta"
    );
  });
});

describe("automation Decision → Pending", () => {
  it("Appointment.Created → SetPendingDecision when clinic requires confirmation", () => {
    const { commands, appliedRuleIds } = runAutomation({
      eventType: "Appointment.Created",
      caseId: "c1",
      currentPhase: "consulta",
      policy: evaluateDomainPolicy({
        eventType: "Appointment.Created",
        currentPhase: "consulta",
      }),
      clinic,
      payload: {},
      eventId: "e1",
    });
    assert.ok(appliedRuleIds.includes("pending-patient-confirm"));
    assert.ok(
      commands.some(
        (c) =>
          c.type === "SetPendingDecision" &&
          c.pending.type === "confirm_slot" &&
          c.pending.waiting_for === "patient"
      )
    );
  });

  it("skips confirm pending when clinic policy disables it", () => {
    const { commands } = runAutomation({
      eventType: "Appointment.Created",
      caseId: "c1",
      currentPhase: "consulta",
      policy: evaluateDomainPolicy({
        eventType: "Appointment.Created",
        currentPhase: "consulta",
      }),
      clinic: resolveClinicPolicy({ requireAppointmentConfirmation: false }),
      payload: {},
      eventId: "e1",
    });
    assert.equal(
      commands.filter((c) => c.type === "SetPendingDecision").length,
      0
    );
  });

  it("Handoff.Taken → AssignOwner human", () => {
    const { commands } = runAutomation({
      eventType: "Handoff.Taken",
      caseId: "c1",
      currentPhase: "captacao",
      policy: { allowed: true },
      clinic,
      payload: { human_user_id: "u1" },
      eventId: "e2",
    });
    assert.ok(
      commands.some(
        (c) => c.type === "AssignOwner" && c.owner === "human:u1"
      )
    );
  });
});

describe("command idempotency key", () => {
  it("same event + pending command → same key", () => {
    const cmd: CaseCommand = {
      type: "SetPendingDecision",
      caseId: "c1",
      pending: { type: "confirm_slot", waiting_for: "patient" },
    };
    assert.equal(
      commandKey(cmd, "evt-1"),
      commandKey(cmd, "evt-1")
    );
    assert.notEqual(commandKey(cmd, "evt-1"), commandKey(cmd, "evt-2"));
  });
});

describe("transition guardrails", () => {
  it("only allows case/task commands", () => {
    assert.ok(TRANSITION_ALLOWED_COMMANDS.has("SetPhase"));
    assert.ok(TRANSITION_ALLOWED_COMMANDS.has("SetPendingDecision"));
    assert.equal(
      (TRANSITION_ALLOWED_COMMANDS as Set<string>).has("CreatePayment"),
      false
    );
  });
});

describe("context engine", () => {
  it("shows finance panels in financeiro phase", () => {
    const panels = panelsForPhaseCode("financeiro");
    assert.ok(panels.includes("financeiro"));
    assert.equal(derivedObjectiveForPhase("financeiro"), "Receber pagamento");
  });
});

describe("AI intents vs domain facts", () => {
  it("blocks Appointment.Created for AI", () => {
    const p = resolveAIPolicy();
    assert.equal(aiMayPublishEvent(p, "Appointment.Created"), false);
    assert.equal(isDomainFactBlockedForAi("Appointment.Created"), true);
  });

  it("allows Booking.Requested and Handoff.Taken", () => {
    const p = resolveAIPolicy();
    assert.equal(isAiIntentEvent("Booking.Requested"), true);
    assert.equal(aiMayPublishEvent(p, "Booking.Requested"), true);
    assert.equal(aiMayPublishEvent(p, "Handoff.Taken"), true);
  });

  it("blocks disqualify by default", () => {
    const p = resolveAIPolicy();
    assert.equal(aiMayPublishEvent(p, "Lead.Disqualified"), false);
  });
});

describe("automation priority", () => {
  it("override exclusive beats lower rules", () => {
    const { commands, appliedRuleIds } = runAutomation({
      eventType: "Case.OverrideRequested",
      caseId: "c1",
      currentPhase: "captacao",
      policy: evaluateDomainPolicy({
        eventType: "Case.OverrideRequested",
        currentPhase: "captacao",
      }),
      clinic,
      payload: { target_phase: "financeiro" },
      eventId: "e1",
    });
    assert.ok(appliedRuleIds.includes("override-phase"));
    assert.ok(
      commands.some((c) => c.type === "SetPhase" && c.phase === "financeiro")
    );
  });
});
