import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitPendingActiveSelection,
  deriveActiveSelection,
  preparePendingActiveSelection,
} from "../active-selection";
import { resolveReferenceFacts } from "../resolve-facts";
import { mergeAiState } from "../patch";
import { initialAiState } from "../types";
import { stampOfferedSlots } from "../selection-context";
import { extractFacts } from "../../extractors";
import { withProcessingLockStamp } from "../../infra/lock";
import { resetLoopGuardAfterSuccessfulMutation } from "@/lib/virtual-assistant/bot-loop-guard";

describe("active_selection index resolution (debug regression)", () => {
  it("with residual offered_days + valid friday slots, index 1 picks slot not day 1", () => {
    const fridaySlots = [
      { scheduled_at: "2026-07-17T11:00:00.000Z", display: "08:00" },
      { scheduled_at: "2026-07-17T11:30:00.000Z", display: "08:30" },
    ];
    const booking = stampOfferedSlots(
      {
        doctor_id: "d1",
        procedure_id: "p1",
        date: "2026-07-17",
        status: "collecting",
      },
      fridaySlots,
      { doctor_id: "d1", procedure_id: "p1", date: "2026-07-17", period: null }
    );

    const state = {
      ...initialAiState(),
      offered_days: [
        { date: "2026-07-15", label: "qua. 15/07", index: 1 },
        { date: "2026-07-16", label: "qui. 16/07", index: 2 },
        { date: "2026-07-17", label: "sex. 17/07", index: 3 },
      ],
      active_selection: {
        type: "slot" as const,
        options: fridaySlots.map((s, i) => ({
          id: s.scheduled_at,
          label: s.display,
          index: i + 1,
        })),
      },
      booking,
    };

    const facts = extractFacts("1", new Date(), fridaySlots);
    const patch = resolveReferenceFacts(facts, state);
    assert.equal(patch.booking?.pending_slot, "2026-07-17T11:00:00.000Z");
    assert.equal(patch.booking?.date ?? state.booking?.date, "2026-07-17");
  });

  it("deriveActiveSelection prefers slots over days when no active_selection", () => {
    const booking = stampOfferedSlots(
      { date: "2026-07-17", status: "collecting" },
      [{ scheduled_at: "2026-07-17T11:00:00.000Z", display: "08:00" }],
      { date: "2026-07-17" }
    );
    const derived = deriveActiveSelection({
      ...initialAiState(),
      offered_days: [{ date: "2026-07-15", label: "qua", index: 1 }],
      booking,
    });
    assert.equal(derived?.type, "slot");
  });

  it("afternoon list index 1 sets pending_slot even if day menu residual", () => {
    const afternoon = [
      { scheduled_at: "2026-07-15T17:30:00.000Z", display: "14:30" },
      { scheduled_at: "2026-07-15T18:00:00.000Z", display: "15:00" },
    ];
    const booking = stampOfferedSlots(
      {
        doctor_id: "d1",
        procedure_id: "p1",
        date: "2026-07-15",
        status: "collecting",
      },
      afternoon,
      { doctor_id: "d1", procedure_id: "p1", date: "2026-07-15", period: null }
    );
    const state = {
      ...initialAiState(),
      offered_days: [{ date: "2026-07-15", label: "qua. 15/07", index: 1 }],
      booking,
      active_selection: preparePendingActiveSelection(
        "slot",
        afternoon.map((s, i) => ({
          id: s.scheduled_at,
          label: s.display,
          index: i + 1,
        }))
      ),
    };
    const patch = resolveReferenceFacts({ selectedIndex: 1 }, state);
    assert.equal(patch.booking?.pending_slot, "2026-07-15T17:30:00.000Z");
  });

  it("commitPendingActiveSelection clears competing day menu for slots", () => {
    const pending = preparePendingActiveSelection("slot", [
      { id: "2026-07-17T11:00:00.000Z", label: "08:00", index: 1 },
    ]);
    const committed = commitPendingActiveSelection({
      ...initialAiState(),
      offered_days: [{ date: "2026-07-15", label: "qua", index: 1 }],
      pending_active_selection: pending,
      booking: { status: "collecting", date: "2026-07-17" },
    });
    assert.equal(committed.active_selection?.type, "slot");
    assert.equal(committed.offered_days, undefined);
    assert.equal(committed.pending_active_selection, undefined);
  });
});

describe("processing lock stamp", () => {
  it("withProcessingLockStamp preserves claim across shallow merges", () => {
    const stamp = "2026-07-15T17:10:00.000Z";
    const merged = withProcessingLockStamp(
      { booking: { status: "collecting" }, patient_id: "p1" } as Record<string, unknown>,
      stamp
    );
    assert.equal(merged.ai_processing_started_at, stamp);
  });
});

describe("resetLoopGuardAfterSuccessfulMutation", () => {
  it("resets bot_loop_window_since and clears loop handoff reason", () => {
    const next = resetLoopGuardAfterSuccessfulMutation({
      bot_loop_detected_at: "2026-07-15T17:00:00.000Z",
      handoff_reason: "bot_loop_detected",
      bot_loop_window_since: "2026-07-15T16:00:00.000Z",
      booking: { status: "done" as const },
    });
    assert.equal(next.bot_loop_detected_at, undefined);
    assert.equal(next.handoff_reason, undefined);
    assert.ok(next.bot_loop_window_since);
    assert.notEqual(next.bot_loop_window_since, "2026-07-15T16:00:00.000Z");
  });
});

describe("merge after day then slot list", () => {
  it("replay: day 3 then index 1 keeps friday pending", () => {
    const days = [
      { date: "2026-07-15", label: "qua. 15/07", index: 1 },
      { date: "2026-07-16", label: "qui. 16/07", index: 2 },
      { date: "2026-07-17", label: "sex. 17/07", index: 3 },
    ];
    let state: ReturnType<typeof initialAiState> = {
      ...initialAiState(),
      offered_days: days,
      active_selection: preparePendingActiveSelection(
        "day",
        days.map((d) => ({ id: d.date, label: d.label, index: d.index }))
      ),
      booking: {
        doctor_id: "d1",
        procedure_id: "p1",
        status: "collecting",
      },
    };

    const dayPatch = resolveReferenceFacts({ selectedIndex: 3 }, state);
    state = mergeAiState(state, dayPatch);
    assert.equal(state.booking?.date, "2026-07-17");

    const fridaySlots = [
      { scheduled_at: "2026-07-17T11:00:00.000Z", display: "08:00" },
      { scheduled_at: "2026-07-17T17:30:00.000Z", display: "14:30" },
    ];
    state = mergeAiState(state, {
      offered_days: undefined,
      active_selection: preparePendingActiveSelection(
        "slot",
        fridaySlots.map((s, i) => ({
          id: s.scheduled_at,
          label: s.display,
          index: i + 1,
        }))
      ),
      booking: stampOfferedSlots(
        state.booking,
        fridaySlots,
        {
          doctor_id: "d1",
          procedure_id: "p1",
          date: "2026-07-17",
          period: null,
        }
      ),
    });

    const slotPatch = resolveReferenceFacts({ selectedIndex: 1 }, state);
    assert.equal(slotPatch.booking?.pending_slot, "2026-07-17T11:00:00.000Z");
    assert.equal(state.booking?.date, "2026-07-17");
  });
});
