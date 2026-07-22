import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pendingToNextDecision,
  nextDecisionToPending,
  waitingForToActor,
  actionGroupLabel,
  formatWhyNow,
} from "../next-decision";
import { toCaseProductView } from "../case-product";
import {
  buildHojeHref,
  parseHojeSearchParams,
  actionToHojeContext,
  normalizeHojeArea,
} from "@/lib/operational-journey/hoje-href";

describe("NextDecision adapters", () => {
  it("maps pending_decision to NextDecision with actor", () => {
    const next = pendingToNextDecision({
      type: "confirm_slot",
      waiting_for: "patient",
      label: "Confirmar consulta",
      due_at: null,
    });
    assert.ok(next);
    assert.equal(next!.action, "confirm_slot");
    assert.equal(next!.actor, "patient");
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
    assert.equal(waitingForToActor(pending.waiting_for), "human");
  });

  it("actionGroupLabel for CTAs", () => {
    assert.equal(actionGroupLabel("confirm_slot"), "Confirmar consultas");
  });

  it("formatWhyNow for tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const reason = formatWhyNow(tomorrow.toISOString());
    assert.ok(reason);
    assert.match(reason!, /amanhã/);
  });
});

describe("CaseProductView", () => {
  it("builds journey + stage + context + nextDecision", () => {
    const view = toCaseProductView({
      id: "c1",
      ownerType: "ai",
      journey: "appointment",
      stage: "awaiting_confirmation",
      patientId: "p1",
      appointmentId: "a1",
      conversationId: "conv1",
      pendingDecision: {
        type: "confirm_slot",
        waiting_for: "patient",
        label: "Escolher horário",
      },
    });
    assert.equal(view.owner, "ai");
    assert.equal(view.journey, "appointment");
    assert.equal(view.stage, "awaiting_confirmation");
    assert.equal(view.context.patientId, "p1");
    assert.equal(view.context.appointmentId, "a1");
    assert.equal(view.context.conversationId, "conv1");
    assert.equal(view.nextDecision?.actor, "patient");
  });
});

describe("Hoje deep link contract v7", () => {
  it("buildHojeHref and parse round-trip", () => {
    const href = buildHojeHref({
      area: "atendimentos",
      stage: "confirmar",
      caseId: "abc",
    });
    assert.equal(href, "/dashboard/hoje?area=atendimentos&stage=confirmar&case=abc");
    const parsed = parseHojeSearchParams({
      area: "atendimentos",
      stage: "confirmar",
      case: "abc",
    });
    assert.equal(parsed.area, "atendimentos");
    assert.equal(parsed.stage, "confirmar");
    assert.equal(parsed.caseId, "abc");
  });

  it("aliases v6 areas to v7", () => {
    assert.equal(normalizeHojeArea("contatos"), "pessoas");
    assert.equal(normalizeHojeArea("agendamentos"), "agenda");
    assert.equal(normalizeHojeArea("consultas"), "atendimentos");
    assert.equal(parseHojeSearchParams({ area: "consultas" }).area, "atendimentos");
  });

  it("actionToHojeContext maps confirm to atendimentos", () => {
    const ctx = actionToHojeContext("confirm_slot", "c1");
    assert.equal(ctx.area, "atendimentos");
    assert.equal(ctx.stage, "confirmar");
    assert.equal(ctx.caseId, "c1");
  });
});
