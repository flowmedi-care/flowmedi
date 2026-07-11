import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyErrorMessage, outcomeFromToolResult } from "../error-class";
import { shouldIncrementToolFailures } from "../mutation-result";
import { errorResult, needsInputResult } from "../types";

describe("error-class", () => {
  it("classifies CPF errors as business", () => {
    assert.equal(classifyErrorMessage("CPF inválido"), "business");
  });

  it("classifies conflict as business", () => {
    assert.equal(classifyErrorMessage("Conflito de horário"), "business");
  });

  it("needs_input is recoverable", () => {
    assert.equal(outcomeFromToolResult(needsInputResult(["x"], "falta")), "recoverable");
  });

  it("business error does not increment tool failures", () => {
    assert.equal(
      shouldIncrementToolFailures(outcomeFromToolResult(errorResult("CPF inválido"))),
      false
    );
  });
});
