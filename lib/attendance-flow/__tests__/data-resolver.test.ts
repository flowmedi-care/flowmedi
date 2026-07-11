import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveSemanticValue,
  isFilled,
  buildResolverContext,
} from "../data-resolver";
import type { AiState } from "@/lib/chatbot/state/types";

describe("GoalDataResolver", () => {
  const aiState: AiState = { consecutive_tool_failures: 0 };

  it("resolves cpf from turnFacts first", () => {
    const ctx = buildResolverContext({
      aiState,
      collected: {},
      patient: { cpf: "11111111111" },
      turnFacts: { cpf: "05126248103" },
    });
    assert.equal(resolveSemanticValue("cpf", ctx), "05126248103");
  });

  it("resolves cpf from patient when not in collected", () => {
    const ctx = buildResolverContext({
      aiState,
      collected: {},
      patient: { cpf: "05126248103" },
    });
    assert.equal(resolveSemanticValue("cpf", ctx), "05126248103");
  });

  it("resolves email from collected in same turn", () => {
    const ctx = buildResolverContext({
      aiState,
      collected: { email: "a@b.com" },
      patient: null,
      turnFacts: {},
    });
    assert.equal(resolveSemanticValue("email", ctx), "a@b.com");
  });

  it("isFilled rejects empty", () => {
    assert.equal(isFilled(""), false);
    assert.equal(isFilled("x"), true);
  });
});
