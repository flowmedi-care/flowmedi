import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractDate,
  relativeDateFromText,
  hasDateIntent,
} from "../date";
import { extractFacts } from "../index";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/clinic-timezone";

describe("relativeDateFromText / extractDate", () => {
  const ref = new Date("2026-07-15T14:00:00.000Z"); // 11:00 SP

  it("amanhã → next clinic day", () => {
    assert.equal(
      relativeDateFromText("Para amanhã 10 da manha", ref, DEFAULT_CLINIC_TIMEZONE),
      "2026-07-16"
    );
    assert.equal(extractDate("Para amanhã 10 da manha", ref), "2026-07-16");
  });

  it("hoje → clinic today", () => {
    assert.equal(extractDate("Hoje é dia 15", ref), "2026-07-15");
  });

  it("dia 16 after today 15 → same month", () => {
    assert.equal(extractDate("Mas amanhã e dia 16", ref), "2026-07-16");
  });

  it("dia 10 when today is 15 → next month", () => {
    assert.equal(extractDate("dia 10", ref), "2026-08-10");
  });

  it("hasDateIntent for calendar phrases", () => {
    assert.equal(hasDateIntent("Hoje é dia 15"), true);
    assert.equal(hasDateIntent("amanhã"), true);
    assert.equal(hasDateIntent("pode ser as 4 da tarde"), false);
  });

  it("dia 16 does not set time_unmatched", () => {
    const offered = [
      { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
      { scheduled_at: "2026-07-17T19:00:00.000Z", display: "16:00" },
    ];
    const facts = extractFacts("Mas amanhã e dia 16", ref, offered);
    assert.equal(facts.date, "2026-07-16");
    assert.equal(facts.time_unmatched, undefined);
    assert.equal(facts.selected_scheduled_at, undefined);
  });

  it("Hoje é dia 15 does not seek 15:00", () => {
    const offered = [{ scheduled_at: "2026-07-17T18:00:00.000Z", display: "15:00" }];
    const facts = extractFacts("Eu falo o dia! Hoje é dia 15", ref, offered);
    assert.equal(facts.date, "2026-07-15");
    assert.equal(facts.time_unmatched, undefined);
    assert.equal(facts.selected_scheduled_at, undefined);
  });

  it("Para amanhã 10 da manha: date+period, no time_unmatched vs stale list", () => {
    const afternoon = [
      { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
      { scheduled_at: "2026-07-17T16:30:00.000Z", display: "13:30" },
    ];
    const facts = extractFacts("Para amanhã 10 da manha", ref, afternoon);
    assert.equal(facts.date, "2026-07-16");
    assert.equal(facts.period, "manha");
    assert.equal(facts.time_unmatched, undefined);
  });
});
