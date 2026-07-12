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

  it("contrato: selectedIndex 7 → booking.date === offered_days[6].date", () => {
    const offered_days = [
      { date: "2026-07-13", label: "seg. 13/07", index: 1 },
      { date: "2026-07-14", label: "ter. 14/07", index: 2 },
      { date: "2026-07-15", label: "qua. 15/07", index: 3 },
      { date: "2026-07-16", label: "qui. 16/07", index: 4 },
      { date: "2026-07-17", label: "sex. 17/07", index: 5 },
      { date: "2026-07-18", label: "sáb. 18/07", index: 6 },
      { date: "2026-07-20", label: "seg. 20/07", index: 7 },
    ];
    const state = {
      ...initialAiState(),
      booking: {
        doctor_id: "82950bcf-2d9d-4760-a9a5-99a315ca3dd9",
        procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0",
        status: "collecting" as const,
      },
      offered_days,
    };
    const patch = resolveReferenceFacts({ selectedIndex: 7 }, state);
    assert.equal(patch.booking?.date, offered_days[6]!.date);
    assert.equal(patch.booking?.date, "2026-07-20");
  });

  it("resolve date from weekday facts", () => {
    const patch = resolveReferenceFacts({ date: "2026-07-13" }, initialAiState());
    assert.equal(patch.booking?.date, "2026-07-13");
  });
});
