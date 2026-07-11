import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTimeChoice } from "../../extractors/time";

describe("extractTimeChoice", () => {
  const slots = [
    { scheduled_at: "2026-07-15T16:00:00.000Z", display: "13:00" },
    { scheduled_at: "2026-07-15T16:30:00.000Z", display: "13:30" },
  ];

  it("matches 'Pode ser 13' when slot hour aligns locally", () => {
    const pick = extractTimeChoice("Pode ser 13", slots);
    assert.ok(pick);
    assert.ok(pick!.scheduled_at);
  });

  it("matches 13h pattern", () => {
    const pick = extractTimeChoice("13h", slots);
    assert.ok(pick);
  });
});
