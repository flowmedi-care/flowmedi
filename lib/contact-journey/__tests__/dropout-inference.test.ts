import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferDropoutReason } from "../dropout-inference";

describe("dropout-inference", () => {
  it("detects price objection from user messages", () => {
    const result = inferDropoutReason({
      messages: [
        { role: "assistant", content: "O valor é R$ 500" },
        { role: "user", content: "Está muito caro para mim" },
      ],
      journeyStep: "orcamento_enviado",
    });
    assert.equal(result.motivoProvavel, "preco");
    assert.equal(result.confianca, "alta");
  });

  it("returns nao_respondeu when no user messages", () => {
    const result = inferDropoutReason({
      messages: [{ role: "assistant", content: "Olá!" }],
    });
    assert.equal(result.motivoProvavel, "nao_respondeu");
  });
});
