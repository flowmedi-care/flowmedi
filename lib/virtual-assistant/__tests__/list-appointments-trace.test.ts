import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListAppointmentStages,
  classifyListEmptyDiagnosis,
  LIST_PATIENT_APPOINTMENTS_SELECT,
  mapListedAppointmentRows,
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

  it("diagnosis: query_failed when afterDateFilter>0 but supabase returned 0 rows", () => {
    const trace = baseTrace({
      stages: {
        beforeFilters: 22,
        afterStatusFilter: 14,
        afterDateFilter: 3,
        resultCount: 0,
      },
      counts: {
        totalForSelectedPatient: 22,
        cancelable: 14,
        upcomingCancelable: 3,
        overdueCancelable: 11,
      },
      queryTail: {
        queryExecuted: {
          select: LIST_PATIENT_APPOINTMENTS_SELECT,
          upcomingOnly: true,
          nowIso: NOW,
        },
        supabaseError: "Could not embed because more than one relationship was found",
        supabaseDataLength: 0,
        afterMap: 0,
      },
    });
    assert.equal(classifyListEmptyDiagnosis(trace), "query_failed");
  });

  it("functional payload stays { appointments } — diagnostics are observability-only", () => {
    const functional = { appointments: [] as unknown[] };
    assert.deepEqual(Object.keys(functional), ["appointments"]);
    assert.equal("diagnostics" in functional, false);
    assert.equal("listExecutionTrace" in functional, false);
  });

  it("list select uses disambiguated procedures!procedure_id", () => {
    assert.match(LIST_PATIENT_APPOINTMENTS_SELECT, /procedures!procedure_id/);
    assert.doesNotMatch(LIST_PATIENT_APPOINTMENTS_SELECT, /procedure:procedures\(name\)/);
  });

  it("map never discards rows when doctor/procedure embeds are null", () => {
    const mapped = mapListedAppointmentRows(
      [
        {
          id: "b2225551",
          scheduled_at: "2026-07-16T13:00:00.000Z",
          status: "agendada",
          valor: null,
          patient_id: "f2ed8c79",
          doctor: null,
          procedure: null,
        },
        {
          id: "b2",
          scheduled_at: "2026-07-17T13:00:00.000Z",
          status: "confirmada",
          doctor: { full_name: "Dr X" },
          procedure: { name: "Consulta" },
        },
      ],
      "f2ed8c79"
    );
    assert.equal(mapped.length, 2);
    assert.equal(mapped[0]?.doctor_name, null);
    assert.equal(mapped[0]?.procedure_name, null);
    assert.equal(mapped[1]?.doctor_name, "Dr X");
  });

  it("regression: primary overdue wins before sibling merge when upcoming empty", () => {
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

  it("trace shape includes matchedPatientIds, filters, stage counts, and queryTail", () => {
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
      queryTail: {
        queryExecuted: {
          select: LIST_PATIENT_APPOINTMENTS_SELECT,
          upcomingOnly: true,
          nowIso: NOW,
        },
        supabaseError: null,
        supabaseDataLength: 1,
        afterMap: 1,
      },
    });
    assert.ok(Array.isArray(trace.matchedPatientIds));
    assert.deepEqual(trace.effectiveFilters.statuses, ["agendada", "confirmada"]);
    assert.equal(trace.effectiveFilters.upcomingOnly, true);
    assert.equal(trace.stages.beforeFilters, 2);
    assert.equal(trace.stages.afterStatusFilter, 1);
    assert.equal(trace.stages.afterDateFilter, 0);
    assert.equal(trace.stages.resultCount, 1);
    assert.equal(trace.queryTail?.supabaseDataLength, 1);
    assert.equal(trace.queryTail?.afterMap, 1);
    assert.equal(classifyListEmptyDiagnosis(trace), null);
  });
});
