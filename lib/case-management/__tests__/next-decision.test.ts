import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pendingToNextDecision,
  nextDecisionToPending,
  waitingForToActor,
  actionGroupLabel,
  formatWhyNow,
} from "../next-decision";
import {
  buildHojeHref,
  parseHojeSearchParams,
  actionToHojeContext,
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

describe("Hoje deep link contract", () => {
  it("buildHojeHref and parse round-trip", () => {
    const href = buildHojeHref({
      area: "consultas",
      stage: "confirmar",
      caseId: "abc",
    });
    assert.equal(href, "/dashboard/hoje?area=consultas&stage=confirmar&case=abc");
    const parsed = parseHojeSearchParams({
      area: "consultas",
      stage: "confirmar",
      case: "abc",
    });
    assert.equal(parsed.area, "consultas");
    assert.equal(parsed.stage, "confirmar");
    assert.equal(parsed.caseId, "abc");
  });

  it("actionToHojeContext maps confirm to consultas", () => {
    const ctx = actionToHojeContext("confirm_slot", "c1");
    assert.equal(ctx.area, "consultas");
    assert.equal(ctx.stage, "confirmar");
    assert.equal(ctx.caseId, "c1");
  });
});
