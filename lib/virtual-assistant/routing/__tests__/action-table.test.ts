import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveGlobalAction } from "../action-table";

describe("resolveGlobalAction", () => {
  it("returns deterministic greeting for captacao", () => {
    const action = resolveGlobalAction({
      derivedStage: "captacao",
      detectedIntent: "greeting",
      aiState: {},
    });
    assert.equal(action.type, "deterministic_reply");
  });

  it("returns booking_handler for agendamento with slots", () => {
    const action = resolveGlobalAction({
      derivedStage: "agendamento",
      detectedIntent: "booking",
      aiState: {
        offered_slots: [{ scheduled_at: "2026-07-10T15:30:00Z", display: "15:30" }],
      },
    });
    assert.equal(action.type, "booking_handler");
  });

  it("passes through when reply already set", () => {
    const action = resolveGlobalAction({
      derivedStage: "captacao",
      detectedIntent: "unknown",
      aiState: {},
      hasReply: true,
    });
    assert.equal(action.type, "pass_through");
  });
});
