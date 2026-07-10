import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EVAL_SCENARIOS } from "./conversation-eval";
import { validateToolCall } from "../guardrails/validators";
import { initialAiState } from "../state/types";

describe("conversation eval suite", () => {
  it("tem pelo menos 25 cenários", () => {
    assert.ok(EVAL_SCENARIOS.length >= 25);
  });

  for (const scenario of EVAL_SCENARIOS.filter((s) => s.expectedMissing?.length)) {
    it(`${scenario.id}: ${scenario.description} — missing params`, () => {
      const tool = scenario.expectedTool!;
      const result = validateToolCall(tool, {}, initialAiState(), {});
      assert.ok(result, `esperava validation para ${tool}`);
      assert.equal(result!.status, "needs_input");
    });
  }
});
