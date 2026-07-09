import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldUseSimpleAssistant } from "../run";

describe("shouldUseSimpleAssistant", () => {
  it("defaults to true when unset", () => {
    assert.equal(shouldUseSimpleAssistant({}), true);
  });

  it("respects explicit false", () => {
    assert.equal(shouldUseSimpleAssistant({ use_simple_assistant: false }), false);
  });

  it("respects explicit true", () => {
    assert.equal(shouldUseSimpleAssistant({ use_simple_assistant: true }), true);
  });
});
