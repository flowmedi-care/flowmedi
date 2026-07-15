import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCheckInWindow,
  resolveCheckInPolicy,
  type CheckInAppointmentSummary,
  type ListCheckInResult,
  type PerformCheckInResult,
} from "@/lib/virtual-assistant/services/check-in";
import { mergeAppointmentPolicy, DEFAULT_CHECK_IN_POLICY } from "@/lib/attendance-flow/defaults";
import type { DomainMutationResult } from "@/lib/domain/mutation-result";

describe("check-in domain: policy merge", () => {
  it("defaults enabled false and window 2h / 30m", () => {
    const policy = mergeAppointmentPolicy(null);
    assert.equal(policy.check_in.enabled, false);
    assert.equal(policy.check_in.window.opens_before_hours, 2);
    assert.equal(policy.check_in.window.closes_after_minutes, 30);
  });

  it("stored overrides merge", () => {
    const policy = mergeAppointmentPolicy({
      check_in: { enabled: true, window: { opens_before_hours: 4 } },
    });
    assert.equal(policy.check_in.enabled, true);
    assert.equal(policy.check_in.window.opens_before_hours, 4);
    assert.equal(policy.check_in.window.closes_after_minutes, 30);
  });

  it("resolveCheckInPolicy uses defaults", () => {
    const resolved = resolveCheckInPolicy({});
    assert.deepEqual(resolved.window, { ...DEFAULT_CHECK_IN_POLICY.window });
    assert.equal(resolved.enabled, false);
  });
});

describe("check-in domain: window", () => {
  const policy = mergeAppointmentPolicy({
    check_in: {
      enabled: true,
      window: { opens_before_hours: 2, closes_after_minutes: 30 },
    },
  });
  const checkIn = resolveCheckInPolicy(policy);
  // Appointment at 14:00 local-ish — use fixed ISO
  const scheduled = "2026-07-15T17:00:00.000Z"; // 14:00 BRT approx depending on offset; window relative to this instant

  it("TOO_EARLY before opens", () => {
    const now = new Date("2026-07-15T14:00:00.000Z"); // 3h before
    const result = evaluateCheckInWindow(scheduled, checkIn, now);
    assert.equal(result.type, "TOO_EARLY");
    if (result.type === "TOO_EARLY") {
      assert.equal(result.nextEligibleAt, "2026-07-15T15:00:00.000Z");
    }
  });

  it("IN_WINDOW inside opens/closes", () => {
    const now = new Date("2026-07-15T16:00:00.000Z"); // 1h before
    assert.equal(evaluateCheckInWindow(scheduled, checkIn, now).type, "IN_WINDOW");
  });

  it("WINDOW_CLOSED after closes_after_minutes", () => {
    const now = new Date("2026-07-15T17:45:00.000Z"); // 45m after
    assert.equal(evaluateCheckInWindow(scheduled, checkIn, now).type, "WINDOW_CLOSED");
  });
});

describe("check-in domain: typed results (no reason string API)", () => {
  it("ListCheckInResult variants are discriminable", () => {
    const samples: ListCheckInResult[] = [
      { type: "DISABLED" },
      { type: "TOO_EARLY", nextEligibleAt: "2026-07-15T15:00:00.000Z" },
      { type: "NO_ELIGIBLE_APPOINTMENTS" },
      {
        type: "SUCCESS",
        appointments: [
          {
            id: "a",
            scheduled_at: "2026-07-15T17:00:00.000Z",
            status: "confirmada",
            doctor_name: null,
            procedure_name: null,
            valor: null,
          } satisfies CheckInAppointmentSummary,
        ],
      },
    ];
    assert.equal(samples[0]!.type, "DISABLED");
    assert.equal(samples[3]!.type, "SUCCESS");
  });

  it("PerformCheckInResult uses DomainMutationResult", () => {
    const ok: PerformCheckInResult = {
      type: "SUCCESS",
      data: { appointmentId: "a", checkedInAt: "2026-07-15T16:00:00.000Z" },
    };
    const early: DomainMutationResult<{ appointmentId: string; checkedInAt: string }> = {
      type: "NOT_ALLOWED",
      reason: "TOO_EARLY",
      nextEligibleAt: "2026-07-15T15:00:00.000Z",
    };
    assert.equal(ok.type, "SUCCESS");
    assert.equal(early.type, "NOT_ALLOWED");
    if (early.type === "NOT_ALLOWED") assert.equal(early.reason, "TOO_EARLY");
  });
});
