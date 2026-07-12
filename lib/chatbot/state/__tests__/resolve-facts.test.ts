import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReferenceFacts, applySemanticFacts } from "../resolve-facts";
import { extractFacts } from "../../extractors";
import { initialAiState } from "../types";
import { mergeAiState } from "../patch";

describe("resolveReferenceFacts", () => {
  it("resolve selectedIndex to doctor_id", () => {
    const state = {
      ...initialAiState(),
      offered_doctors: [
        { id: "d1", name: "A", index: 1 },
        { id: "d2", name: "B", index: 2 },
      ],
    };
    const patch = resolveReferenceFacts({ selectedIndex: 2 }, state);
    assert.equal(patch.booking?.doctor_id, "d2");
  });

  it("resolve selectedIndex to offered day", () => {
    const state = {
      ...initialAiState(),
      offered_days: [
        { date: "2026-07-13", label: "seg", index: 1 },
        { date: "2026-07-14", label: "ter", index: 2 },
      ],
    };
    const patch = resolveReferenceFacts({ selectedIndex: 2 }, state);
    assert.equal(patch.booking?.date, "2026-07-14");
  });

  it("contrato: selectedIndex 7 → booking.date === offered_days[6].date", () => {
    const offered_days = [
      { date: "2026-07-13", label: "1", index: 1 },
      { date: "2026-07-14", label: "2", index: 2 },
      { date: "2026-07-15", label: "3", index: 3 },
      { date: "2026-07-16", label: "4", index: 4 },
      { date: "2026-07-17", label: "5", index: 5 },
      { date: "2026-07-18", label: "6", index: 6 },
      { date: "2026-07-20", label: "7", index: 7 },
    ];
    const state = {
      ...initialAiState(),
      offered_days,
    };
    const patch = resolveReferenceFacts({ selectedIndex: 7 }, state);
    assert.equal(patch.booking?.date, offered_days[6]!.date);
  });

  it("does not apply selected_scheduled_at (semantic is separate)", () => {
    const state = {
      ...initialAiState(),
      booking: {
        offered_slots: [
          { scheduled_at: "2026-07-17T13:00:00.000Z", display: "10:00" },
          { scheduled_at: "2026-07-17T16:30:00.000Z", display: "13:30" },
        ],
        status: "collecting" as const,
      },
    };
    const patch = resolveReferenceFacts(
      { selected_scheduled_at: "2026-07-17T13:00:00.000Z" },
      state
    );
    assert.equal(patch.booking?.pending_slot, undefined);
  });

  it("bare index 10 prefers slot #10 over clock 10:00", () => {
    const offered_slots = [
      { scheduled_at: "2026-07-17T11:00:00.000Z", display: "08:00" },
      { scheduled_at: "2026-07-17T11:30:00.000Z", display: "08:30" },
      { scheduled_at: "2026-07-17T12:00:00.000Z", display: "09:00" },
      { scheduled_at: "2026-07-17T12:30:00.000Z", display: "09:30" },
      { scheduled_at: "2026-07-17T13:00:00.000Z", display: "10:00" },
      { scheduled_at: "2026-07-17T13:30:00.000Z", display: "10:30" },
      { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
      { scheduled_at: "2026-07-17T15:30:00.000Z", display: "12:30" },
      { scheduled_at: "2026-07-17T16:00:00.000Z", display: "13:00" },
      { scheduled_at: "2026-07-17T16:30:00.000Z", display: "13:30" },
      { scheduled_at: "2026-07-17T17:00:00.000Z", display: "14:00" },
      { scheduled_at: "2026-07-17T17:30:00.000Z", display: "14:30" },
    ];
    const state = {
      ...initialAiState(),
      booking: {
        doctor_id: "d1",
        procedure_id: "p1",
        date: "2026-07-17",
        offered_slots,
        status: "collecting" as const,
      },
    };
    const facts = extractFacts("10", new Date(), offered_slots);
    assert.equal(facts.selectedIndex, 10);
    assert.equal(facts.selected_scheduled_at, undefined);

    const refPatch = resolveReferenceFacts(facts, state);
    assert.equal(refPatch.booking?.pending_slot, "2026-07-17T16:30:00.000Z");

    const afterRef = mergeAiState(state, refPatch);
    const semPatch = applySemanticFacts(facts, afterRef);
    assert.equal(semPatch.booking?.pending_slot, undefined);
    assert.equal(afterRef.booking?.pending_slot, "2026-07-17T16:30:00.000Z");
  });
});

describe("applySemanticFacts", () => {
  it("maps 10:00 clock to pending_slot", () => {
    const offered = [
      { scheduled_at: "2026-07-15T11:00:00.000Z", display: "08:00" },
      { scheduled_at: "2026-07-15T13:00:00.000Z", display: "10:00" },
    ];
    const state = {
      ...initialAiState(),
      booking: { offered_slots: offered, status: "collecting" as const },
    };
    const facts = extractFacts("10:00", new Date(), offered);
    assert.equal(facts.selected_scheduled_at, "2026-07-15T13:00:00.000Z");
    const patch = applySemanticFacts(facts, state);
    assert.equal(patch.booking?.pending_slot, "2026-07-15T13:00:00.000Z");
  });

  it("resolve date from weekday facts", () => {
    const patch = applySemanticFacts({ date: "2026-07-13" }, initialAiState());
    assert.equal(patch.booking?.date, "2026-07-13");
  });
});
