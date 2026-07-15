import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTimeChoice,
  attemptTimeChoice,
  extractClockPeriodIntent,
  resolveLocalMinutes,
} from "../../extractors/time";
import { extractFacts } from "../../extractors";

describe("extractTimeChoice", () => {
  const slotsSpAfternoon = [
    { scheduled_at: "2026-07-15T16:00:00.000Z", display: "13:00" },
    { scheduled_at: "2026-07-15T16:30:00.000Z", display: "13:30" },
  ];

  /** Production-like: SP morning 10:00 stored as UTC 13:00 */
  const slotsSpMorning = [
    { scheduled_at: "2026-07-15T11:00:00.000Z", display: "08:00" },
    { scheduled_at: "2026-07-15T13:00:00.000Z", display: "10:00" },
    { scheduled_at: "2026-07-15T13:30:00.000Z", display: "10:30" },
  ];

  const slotsWith16 = [
    { scheduled_at: "2026-07-17T19:00:00.000Z", display: "16:00" },
    { scheduled_at: "2026-07-17T19:30:00.000Z", display: "16:30" },
  ];

  const slotsAfternoonEarly = [
    { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
    { scheduled_at: "2026-07-17T16:00:00.000Z", display: "13:00" },
    { scheduled_at: "2026-07-17T17:00:00.000Z", display: "14:00" },
  ];

  it("dia 16 alone is not a clock intent", () => {
    assert.equal(extractClockPeriodIntent("Mas amanhã e dia 16"), null);
    assert.equal(extractClockPeriodIntent("Hoje é dia 15"), null);
  });

  it("matches 'Pode ser 13' via display / clinic timezone", () => {
    const pick = extractTimeChoice("Pode ser 13", slotsSpAfternoon);
    assert.ok(pick);
    assert.equal(pick!.scheduled_at, "2026-07-15T16:00:00.000Z");
  });

  it("matches 13h pattern", () => {
    const pick = extractTimeChoice("13h", slotsSpAfternoon);
    assert.ok(pick);
    assert.equal(pick!.scheduled_at, "2026-07-15T16:00:00.000Z");
  });

  it("matches '10:00' against SP morning slot stored as UTC noon+1", () => {
    const pick = extractTimeChoice("10:00", slotsSpMorning);
    assert.ok(pick);
    assert.equal(pick!.scheduled_at, "2026-07-15T13:00:00.000Z");
    assert.equal(pick!.selected_hour, "10:00");
  });

  it("matches by display even when ISO hour differs from host local", () => {
    const pick = extractTimeChoice("10:30", slotsSpMorning);
    assert.ok(pick);
    assert.equal(pick!.scheduled_at, "2026-07-15T13:30:00.000Z");
  });

  it("two-step: 4 da tarde → 16:00 → matches display", () => {
    const intent = extractClockPeriodIntent("pode ser as 4 da tarde");
    assert.ok(intent);
    assert.equal(intent!.clockHour, 4);
    assert.equal(intent!.periodHint, "tarde");
    assert.equal(resolveLocalMinutes(intent!), 16 * 60);
    const pick = extractTimeChoice("pode ser as 4 da tarde", slotsWith16);
    assert.ok(pick);
    assert.equal(pick!.selected_hour, "16:00");
    assert.equal(pick!.scheduled_at, "2026-07-17T19:00:00.000Z");
  });

  it("4 da tarde with no 16:00 slot → no_match, no pending invented", () => {
    const attempt = attemptTimeChoice("pode ser as 4 da tarde", slotsAfternoonEarly);
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.reason, "no_match");
      assert.equal(attempt.resolvedHour, "16:00");
    }
    const facts = extractFacts("pode ser as 4 da tarde", new Date(), slotsAfternoonEarly);
    assert.equal(facts.selected_scheduled_at, undefined);
    assert.equal(facts.time_unmatched, true);
    assert.equal(facts.unresolved_hour, "16:00");
  });

  it("matches 16h / 16:00 against display", () => {
    assert.equal(extractTimeChoice("16h", slotsWith16)?.selected_hour, "16:00");
    assert.equal(extractTimeChoice("16:00", slotsWith16)?.selected_hour, "16:00");
  });
});
