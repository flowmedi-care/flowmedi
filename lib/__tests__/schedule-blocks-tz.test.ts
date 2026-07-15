import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandBlockOccurrences, type ScheduleBlockRow } from "../schedule-blocks";
import { dayBoundsForScheduledAt } from "../appointment-scheduling";
import { zonedLocalToUtcIso } from "../clinic-timezone";
import { renderSlotConfirmation } from "@/lib/chatbot/tools/render-structured";

describe("schedule block timezone (clinic-local)", () => {
  it("recurring 09:00-10:00 America/Sao_Paulo overlaps 09:00 BRT slot", () => {
    const block: ScheduleBlockRow = {
      id: "b1",
      clinic_id: "c1",
      doctor_id: "d1",
      title: "Bloqueio manhã",
      block_kind: "recurring",
      starts_at: null,
      ends_at: null,
      recurrence_frequency: "semanal",
      recurrence_weekday: 5, // Friday
      time_start: "09:00",
      time_end: "10:00",
      recurrence_start_date: "2026-07-01",
      recurrence_end_date: "2026-07-31",
    };

    const fridayIso = zonedLocalToUtcIso("2026-07-17", 12, 0, "America/Sao_Paulo");
    const { dayStart, dayEnd } = dayBoundsForScheduledAt(fridayIso, "America/Sao_Paulo");
    const occs = expandBlockOccurrences(
      block,
      new Date(dayStart),
      new Date(dayEnd),
      "America/Sao_Paulo"
    );
    assert.ok(occs.length >= 1);
    const occ = occs[0]!;
    const slotStart = new Date(
      zonedLocalToUtcIso("2026-07-17", 9, 0, "America/Sao_Paulo")
    ).getTime();
    const slotEnd = new Date(
      zonedLocalToUtcIso("2026-07-17", 9, 30, "America/Sao_Paulo")
    ).getTime();
    const occStart = new Date(occ.startsAt).getTime();
    const occEnd = new Date(occ.endsAt).getTime();
    assert.ok(slotStart < occEnd && slotEnd > occStart);
  });
});

describe("pending_slot confirmation label", () => {
  it("uses clinic-local day from ISO (15/07 not 16/07)", () => {
    // 14:30 America/Sao_Paulo on 15 Jul 2026
    const pending = "2026-07-15T17:30:00.000Z";
    const msg = renderSlotConfirmation({
      pendingSlot: pending,
      offeredSlots: [{ scheduled_at: pending, display: "14:30" }],
      askConfirm: true,
    });
    assert.ok(msg?.text);
    assert.match(msg!.text, /15/);
    assert.doesNotMatch(msg!.text, /16\/07/);
  });
});
