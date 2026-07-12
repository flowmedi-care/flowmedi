import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveBookingDate,
  resolveBookingDateFailureMessage,
} from "../resolve-booking-date";
import type { OfferedDay } from "../types";
import { validateToolCall } from "../../guardrails/validators";
import { initialAiState } from "../types";

const offered2026: OfferedDay[] = [
  { date: "2026-07-15", label: "qua. 15/07", index: 1 },
  { date: "2026-07-16", label: "qui. 16/07", index: 2 },
];

describe("resolveBookingDate", () => {
  it("matches ISO exact in offered_days", () => {
    const result = resolveBookingDate({
      dateArg: "2026-07-15",
      offeredDays: offered2026,
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "iso",
    });
  });

  it("resolves menu index", () => {
    const result = resolveBookingDate({
      dateArg: "1",
      offeredDays: offered2026,
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "index",
    });
  });

  it("resolves label fragment 15/07", () => {
    const result = resolveBookingDate({
      dateArg: "15/07",
      offeredDays: offered2026,
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "label",
    });
  });

  it("resolves full label qua. 15/07", () => {
    const result = resolveBookingDate({
      dateArg: "qua. 15/07",
      offeredDays: offered2026,
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "label",
    });
  });

  it("remaps wrong year via MM-DD (2023-07-15 → 2026-07-15)", () => {
    const result = resolveBookingDate({
      dateArg: "2023-07-15",
      offeredDays: offered2026,
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "mmdd",
    });
  });

  it("rejects ambiguous MM-DD across years", () => {
    const result = resolveBookingDate({
      dateArg: "2023-07-15",
      offeredDays: [
        { date: "2026-07-15", label: "qua. 15/07", index: 1 },
        { date: "2027-07-15", label: "qui. 15/07", index: 2 },
      ],
    });
    assert.deepEqual(result, { ok: false, reason: "ambiguous_mmdd" });
  });

  it("rejects date not in offered_days", () => {
    const result = resolveBookingDate({
      dateArg: "2026-08-01",
      offeredDays: offered2026,
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "date_not_in_offered_days",
    });
  });

  it("without offered_days accepts valid ISO as parsed", () => {
    const result = resolveBookingDate({
      dateArg: "2026-07-15",
      offeredDays: [],
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "parsed",
    });
  });

  it("without offered_days rejects bare index", () => {
    const result = resolveBookingDate({
      dateArg: "1",
      offeredDays: undefined,
    });
    assert.deepEqual(result, { ok: false, reason: "invalid_date" });
  });

  it("falls back to bookingDate via MM-DD when dateArg missing", () => {
    const result = resolveBookingDate({
      offeredDays: offered2026,
      bookingDate: "2023-07-15",
    });
    assert.deepEqual(result, {
      ok: true,
      date: "2026-07-15",
      matchedBy: "mmdd",
    });
  });

  it("returns missing_date when nothing to resolve with offered", () => {
    const result = resolveBookingDate({
      offeredDays: offered2026,
    });
    assert.deepEqual(result, { ok: false, reason: "missing_date" });
  });

  it("exposes failure messages for reasons", () => {
    assert.match(
      resolveBookingDateFailureMessage("date_not_in_offered_days"),
      /dias oferecidos|listados/i
    );
    assert.match(
      resolveBookingDateFailureMessage("ambiguous_mmdd"),
      /número|opção/i
    );
  });
});

describe("validateToolCall find_available_slots date sanitize", () => {
  const doctorId = "82950bcf-2d9d-4760-a9a5-99a315ca3dd9";
  const procedureId = "490ed952-9e01-4ff7-b85c-0ab258017fa0";

  it("rewrites wrong-year date arg when offered_days present", () => {
    const args: Record<string, unknown> = {
      doctor_id: doctorId,
      procedure_id: procedureId,
      date: "2023-07-15",
      period: "manha",
    };
    const result = validateToolCall(
      "find_available_slots",
      args,
      {
        ...initialAiState(),
        booking: {
          doctor_id: doctorId,
          procedure_id: procedureId,
          status: "collecting",
        },
        offered_days: offered2026,
      },
      {}
    );
    assert.equal(result, null);
    assert.equal(args.date, "2026-07-15");
  });

  it("blocks date not in offered_days without persisting", () => {
    const args: Record<string, unknown> = {
      doctor_id: doctorId,
      procedure_id: procedureId,
      date: "2020-01-01",
    };
    const result = validateToolCall(
      "find_available_slots",
      args,
      {
        ...initialAiState(),
        booking: {
          doctor_id: doctorId,
          procedure_id: procedureId,
          status: "collecting",
        },
        offered_days: offered2026,
      },
      {}
    );
    assert.ok(result);
    assert.equal(result!.status, "needs_input");
    assert.equal(args.date, "2020-01-01");
  });
});
