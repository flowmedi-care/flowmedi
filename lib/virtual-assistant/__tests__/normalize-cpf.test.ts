import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCpfFromText, normalizeCpf } from "../normalize-cpf";

describe("normalizeCpf", () => {
  it("accepts plain digits", () => {
    assert.equal(normalizeCpf("05126248103"), "05126248103");
  });

  it("accepts formatted CPF", () => {
    assert.equal(normalizeCpf("051.262.481-03"), "05126248103");
  });

  it("accepts spaces and dashes", () => {
    assert.equal(normalizeCpf("051 262 481 03"), "05126248103");
  });

  it("rejects invalid length", () => {
    assert.equal(normalizeCpf("123"), null);
  });

  it("extractCpfFromText finds labeled CPF", () => {
    assert.equal(extractCpfFromText("meu cpf é 051.262.481-03"), "05126248103");
  });
});
