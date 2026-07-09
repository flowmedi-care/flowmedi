import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDormantBookingState } from "../../booking-continuity-guards";
import { clearDormantBookingOnIntentConflict } from "../../booking-reset";
import { detectInboundIntent } from "../../detect-inbound-intent";
import { resolveGlobalAction } from "../../routing/action-table";
import {
  matchOfferedProcedure,
  buildInvalidProcedureSelectionReply,
} from "../procedure-selection";

const offered = [
  { id: "p1", name: "Endoscopia" },
  { id: "p2", name: "Consulta de pancreas" },
  { id: "p3", name: "Apul" },
];

describe("isDormantBookingState", () => {
  it("detects stale procedure step without progress", () => {
    assert.equal(
      isDormantBookingState({ booking_step: "procedure" }),
      true
    );
  });

  it("not dormant when procedure_id set", () => {
    assert.equal(
      isDormantBookingState({ booking_step: "procedure", procedure_id: "p1" }),
      false
    );
  });

  it("not dormant when offered_procedures active", () => {
    assert.equal(
      isDormantBookingState({
        booking_step: "procedure",
        offered_procedures: offered,
      }),
      false
    );
  });
});

describe("discovery intent", () => {
  it("detects com o que trabalham", () => {
    assert.equal(
      detectInboundIntent("Oi quero saber com o que vcs trabalham"),
      "general"
    );
  });
});

describe("clearDormantBookingOnIntentConflict", () => {
  it("clears stale booking on general intent", () => {
    const next = clearDormantBookingOnIntentConflict(
      { booking_step: "procedure", intent: "booking" },
      "general"
    );
    assert.equal(next.booking_step, undefined);
    assert.equal(next.intent, "general");
  });

  it("keeps booking when procedure_id exists", () => {
    const next = clearDormantBookingOnIntentConflict(
      { booking_step: "doctor", procedure_id: "p1", intent: "booking" },
      "general"
    );
    assert.equal(next.procedure_id, "p1");
  });
});

describe("resolveGlobalAction dormant", () => {
  it("routes general to captacao when dormant", () => {
    const action = resolveGlobalAction({
      derivedStage: "captacao",
      detectedIntent: "general",
      aiState: { booking_step: "procedure" },
    });
    assert.equal(action.type, "invoke_subgraph");
    if (action.type === "invoke_subgraph") {
      assert.equal(action.stage, "captacao");
    }
  });
});

describe("matchOfferedProcedure", () => {
  it("selects by index", () => {
    assert.equal(matchOfferedProcedure("1", offered)?.name, "Endoscopia");
    assert.equal(matchOfferedProcedure("3", offered)?.name, "Apul");
  });

  it("selects by name", () => {
    assert.equal(matchOfferedProcedure("Endoscopia", offered)?.id, "p1");
  });

  it("returns null for invalid index", () => {
    assert.equal(matchOfferedProcedure("99", offered), null);
  });

  it("invalid reply does not repeat booking framing", () => {
    const reply = buildInvalidProcedureSelectionReply("99", offered);
    assert.match(reply, /não está na lista/i);
    assert.match(reply, /Endoscopia/);
    assert.doesNotMatch(reply, /verificar horários/i);
  });
});
