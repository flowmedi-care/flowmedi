import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTimeChoice } from "../../extractors/time";

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
});
