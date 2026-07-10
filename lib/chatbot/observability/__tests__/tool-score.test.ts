import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildToolScore, formatToolScoreSummary } from "../tool-score";

describe("tool score", () => {
  it("aggregates per-tool metrics", () => {
    const report = buildToolScore([
      {
        handoff: false,
        tools: [
          { toolName: "find_available_slots", round: 0, blocked: false, status: "success", durationMs: 100 },
          { toolName: "find_available_slots", round: 0, blocked: false, status: "unavailable", durationMs: 80 },
          { toolName: "transfer_to_human", round: 1, blocked: true, status: "needs_input", durationMs: 0 },
        ],
      },
      {
        handoff: true,
        tools: [
          { toolName: "search_faq", round: 0, blocked: false, status: "not_found", durationMs: 50 },
        ],
      },
    ]);

    assert.equal(report.totalCalls, 4);
    assert.equal(report.handoffs, 1);
    assert.equal(report.byTool.find_available_slots?.calls, 2);
    assert.equal(report.byTool.find_available_slots?.retries, 1);
    assert.equal(report.byTool.transfer_to_human?.blocked, 1);
    assert.equal(report.byTool.search_faq?.notFound, 1);
    assert.match(formatToolScoreSummary(report), /find_available_slots/);
  });
});
