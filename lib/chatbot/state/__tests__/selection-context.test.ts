import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  withSelectionFilters,
  getValidOfferedSlots,
  stampOfferedSlots,
  hasValidPendingSlot,
} from "../selection-context";
import { applySemanticFacts } from "../resolve-facts";
import { extractFacts } from "../../extractors";
import { initialAiState } from "../types";
import { resolveDeterministicActions } from "../../agent/deterministic-actions";

describe("selection_context", () => {
  const doctorId = "82950bcf-2d9d-4760-a9a5-99a315ca3dd9";
  const procedureId = "490ed952-9e01-4ff7-b85c-0ab258017fa0";
  const slots = [
    { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
    { scheduled_at: "2026-07-17T16:30:00.000Z", display: "13:30" },
  ];

  it("date change bumps version and clears offered_slots / pending", () => {
    const stamped = stampOfferedSlots(
      { status: "collecting", doctor_id: doctorId, procedure_id: procedureId },
      slots,
      { doctor_id: doctorId, procedure_id: procedureId, date: "2026-07-17", period: null }
    );
    assert.equal(getValidOfferedSlots(stamped).length, 2);
    assert.equal(stamped.selection_context?.version, 1);

    const next = withSelectionFilters(stamped, { date: "2026-07-16", period: null });
    assert.equal(next.selection_context?.version, 2);
    assert.equal(next.offered_slots, undefined);
    assert.equal(next.pending_slot, undefined);
    assert.equal(getValidOfferedSlots(next).length, 0);
  });

  it("doctor change invalidates slots", () => {
    const stamped = stampOfferedSlots(
      { status: "collecting" },
      slots,
      { doctor_id: doctorId, procedure_id: procedureId, date: "2026-07-17" }
    );
    const next = withSelectionFilters(stamped, {
      doctor_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.ok((next.selection_context?.version ?? 0) > (stamped.selection_context?.version ?? 0));
    assert.equal(getValidOfferedSlots(next).length, 0);
  });

  it("epoch mismatch treats residual slots as empty", () => {
    const booking = {
      status: "collecting" as const,
      offered_slots: slots,
      selection_context: {
        version: 3,
        date: "2026-07-16",
        doctor_id: doctorId,
        procedure_id: procedureId,
        period: null,
      },
      selection_epoch: 2,
    };
    assert.equal(getValidOfferedSlots(booking).length, 0);
    assert.equal(hasValidPendingSlot({ ...booking, pending_slot: slots[0]!.scheduled_at }), false);
  });

  it("amanhã 10 da manhã overwrites sticky date and triggers day_selected", () => {
    const ref = new Date("2026-07-15T14:00:00.000Z");
    const before = {
      ...initialAiState(),
      booking: stampOfferedSlots(
        {
          status: "collecting",
          doctor_id: doctorId,
          procedure_id: procedureId,
        },
        slots,
        { doctor_id: doctorId, procedure_id: procedureId, date: "2026-07-17", period: "tarde" }
      ),
    };
    const facts = extractFacts("Para amanhã 10 da manha", ref, getValidOfferedSlots(before.booking));
    const patch = applySemanticFacts(facts, before);
    assert.equal(patch.booking?.date, "2026-07-16");
    assert.equal(getValidOfferedSlots(patch.booking).length, 0);
    assert.equal(patch.booking?.selection_context?.period, "manha");

    const after = { ...before, booking: patch.booking };
    const actions = resolveDeterministicActions({ before, after, facts });
    assert.equal(actions[0]?.toolName, "find_available_slots");
    assert.equal(actions[0]?.args.date, "2026-07-16");
    assert.equal(actions[0]?.args.period, "manha");
  });
});
