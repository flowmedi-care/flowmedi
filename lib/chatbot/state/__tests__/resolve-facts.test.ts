import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveReferenceFacts } from "../resolve-facts";
import { initialAiState } from "../types";

describe("resolveReferenceFacts", () => {
  it("resolve selectedIndex to doctor_id", () => {
    const state = {
      ...initialAiState(),
      offered_doctors: [
        { id: "doc-1", name: "A", index: 1 },
        { id: "doc-2", name: "B", index: 2 },
      ],
    };
    const patch = resolveReferenceFacts({ selectedIndex: 2 }, state);
    assert.equal(patch.booking?.doctor_id, "doc-2");
  });

  it("resolve selectedIndex to offered day", () => {
    const state = {
      ...initialAiState(),
      offered_days: [
        { date: "2026-07-13", label: "Seg 13/07", index: 1 },
        { date: "2026-07-14", label: "Ter 14/07", index: 2 },
      ],
    };
    const patch = resolveReferenceFacts({ selectedIndex: 2 }, state);
    assert.equal(patch.booking?.date, "2026-07-14");
  });

  it("resolve date from weekday facts", () => {
    const patch = resolveReferenceFacts({ date: "2026-07-13" }, initialAiState());
    assert.equal(patch.booking?.date, "2026-07-13");
  });
});
