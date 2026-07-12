import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListAppointmentStages,
  classifyListEmptyDiagnosis,
  resolveListRecoverySource,
  type ListExecutionTrace,
} from "../services/list-appointments-trace";

const NOW = "2026-07-12T15:00:00.000Z";

function baseTrace(
  overrides: Partial<ListExecutionTrace> & {
    stages: ListExecutionTrace["stages"];
    counts: ListExecutionTrace["counts"];
  }
): ListExecutionTrace {
  return {
    clinicId: "clinic-1",
    phone: "5511999999999",
    matchedPatientIds: ["f2ed8c79-primary"],
    patientsMatchedByPhone: 1,
    selectedPatientId: "f2ed8c79-primary",
    resolvedPatientId: "f2ed8c79-primary",
    usedPhoneFallback: false,
    effectiveFilters: { statuses: ["agendada", "confirmada"], upcomingOnly: true },
    ...overrides,
  };
}

describe("list appointments surgical replay", () => {
  it("stages: phone patient rows → status → date → result facts", () => {
    const rows = [
      {
        id: "a1",
        scheduled_at: "2026-07-01T10:00:00.000Z",
        status: "agendada",
      },
      {
        id: "a2",
        scheduled_at: "2026-07-20T10:00:00.000Z",
        status: "agendada",
      },
      {
        id: "a3",
        scheduled_at: "2026-07-20T11:00:00.000Z",
        status: "realizada",
      },
    ];
    const staged = applyListAppointmentStages(rows, { upcomingOnly: true, nowIso: NOW });
    assert.equal(staged.counts.totalForSelectedPatient, 3);
    assert.equal(staged.counts.cancelable, 2);
    assert.equal(staged.counts.overdueCancelable, 1);
    assert.equal(staged.counts.upcomingCancelable, 1);
    assert.equal(staged.afterStatus.length, 2);
    assert.equal(staged.afterDate.length, 1);
    assert.equal(staged.afterDate[0]?.id, "a2");
  });

  it("diagnosis: all cancelable are overdue when date filter empties the list", () => {
    const staged = applyListAppointmentStages(
      [
        {
          id: "overdue",
          scheduled_at: "2026-06-01T10:00:00.000Z",
          status: "confirmada",
        },
      ],
      { upcomingOnly: true, nowIso: NOW }
    );
    const trace = baseTrace({
      stages: {
        beforeFilters: staged.counts.totalForSelectedPatient,
        afterStatusFilter: staged.counts.cancelable,
        afterDateFilter: staged.afterDate.length,
        resultCount: 0,
      },
      counts: staged.counts,
    });
    assert.equal(classifyListEmptyDiagnosis(trace), "all_cancelable_are_overdue");
  });

  it("functional payload stays { appointments } — diagnostics are observability-only", () => {
    const functional = { appointments: [] as unknown[] };
    assert.deepEqual(Object.keys(functional), ["appointments"]);
    assert.equal("diagnostics" in functional, false);
    assert.equal("listExecutionTrace" in functional, false);
  });

  it("regression: primary overdue wins before sibling merge when upcoming empty", () => {
    // Pre-fix smell: siblings present → overdue primary skipped → empty if siblings also empty upcoming.
    assert.equal(
      resolveListRecoverySource({
        primaryUpcoming: 0,
        primaryOverdue: 1,
        siblingUpcoming: 0,
        siblingOverdue: 0,
      }),
      "primary_overdue"
    );
    assert.equal(
      resolveListRecoverySource({
        primaryUpcoming: 0,
        primaryOverdue: 1,
        siblingUpcoming: 1,
        siblingOverdue: 0,
      }),
      "primary_overdue"
    );
    assert.equal(
      resolveListRecoverySource({
        primaryUpcoming: 0,
        primaryOverdue: 0,
        siblingUpcoming: 0,
        siblingOverdue: 2,
      }),
      "sibling_overdue"
    );
  });

  it("trace shape includes matchedPatientIds, filters, and stage counts", () => {
    const trace = baseTrace({
      matchedPatientIds: ["primary", "sibling"],
      patientsMatchedByPhone: 2,
      stages: {
        beforeFilters: 2,
        afterStatusFilter: 1,
        afterDateFilter: 0,
        resultCount: 1,
      },
      counts: {
        totalForSelectedPatient: 2,
        cancelable: 1,
        upcomingCancelable: 0,
        overdueCancelable: 1,
      },
    });
    assert.ok(Array.isArray(trace.matchedPatientIds));
    assert.deepEqual(trace.effectiveFilters.statuses, ["agendada", "confirmada"]);
    assert.equal(trace.effectiveFilters.upcomingOnly, true);
    assert.equal(trace.stages.beforeFilters, 2);
    assert.equal(trace.stages.afterStatusFilter, 1);
    assert.equal(trace.stages.afterDateFilter, 0);
    assert.equal(trace.stages.resultCount, 1);
    assert.equal(classifyListEmptyDiagnosis(trace), null);
  });
});
