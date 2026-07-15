import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFacts, extractDate, extractPeriod, extractIndex, extractOrdinal } from "../index";

describe("chatbot extractors", () => {
  const ref = new Date("2026-07-10T12:00:00");

  it("extractDate from weekday", () => {
    const date = extractDate("segunda de manhã", ref);
    assert.equal(date, "2026-07-13");
  });

  it("extractDate from numeric date", () => {
    assert.equal(extractDate("10/07", ref), "2026-07-10");
    assert.equal(extractDate("13/07/2026", ref), "2026-07-13");
  });

  it("extractPeriod", () => {
    assert.equal(extractPeriod("segunda de manhã"), "manha");
    assert.equal(extractPeriod("à tarde"), "tarde");
    assert.equal(extractPeriod("oi"), null);
    assert.equal(extractPeriod("manhã e tarde"), null);
    assert.equal(extractPeriod("amanhã"), null);
    assert.equal(extractPeriod("amanha"), null);
    assert.equal(extractPeriod("pela manhã"), "manha");
  });

  it("extractIndex", () => {
    assert.equal(extractIndex("2"), 2);
    assert.equal(extractIndex("quero agendar"), null);
  });

  it("extractOrdinal for qualquer um", () => {
    assert.equal(extractOrdinal("marca qualquer um"), 1);
  });

  it("extractFacts aggregates observable fields", () => {
    const facts = extractFacts("segunda de manhã", ref);
    assert.equal(facts.date, "2026-07-13");
    assert.equal(facts.period, "manha");
    assert.equal("intent" in facts, false);
  });

  it("deterministic: same input same output", () => {
    const a = extractFacts("2", ref);
    const b = extractFacts("2", ref);
    assert.deepEqual(a, b);
  });
});
