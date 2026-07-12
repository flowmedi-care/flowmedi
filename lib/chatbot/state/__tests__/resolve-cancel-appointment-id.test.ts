import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialAiState } from "../types";
import {
  authorizeTarget,
  focusedAfterAppointmentListRefresh,
  resolveCancelAppointmentId,
  resolveReference,
} from "../resolve-cancel-appointment-id";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const INVENTED = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PATIENT = "1679cbdc-f69b-4f99-afb6-72f80caf5a14";

describe("resolveReference (pure)", () => {
  const active = [A, B, C];

  it("maps 1-based index 2 → B", () => {
    assert.equal(resolveReference("2", active), B);
  });

  it("maps padded index 02 → B", () => {
    assert.equal(resolveReference("02", active), B);
  });

  it("returns syntactic UUID as-is (idempotent)", () => {
    assert.equal(resolveReference(B, active), B);
    assert.equal(resolveReference(resolveReference("2", active), active), B);
  });

  it("rejects out-of-range and non-1-based indices", () => {
    assert.equal(resolveReference("0", active), null);
    assert.equal(resolveReference("-1", active), null);
    assert.equal(resolveReference("4", active), null);
  });

  it("returns null for empty / non-reference args", () => {
    assert.equal(resolveReference("", active), null);
    assert.equal(resolveReference(undefined, active), null);
    assert.equal(resolveReference("abc", active), null);
  });
});

describe("authorizeTarget", () => {
  it("accepts UUID in allowed set", () => {
    const r = authorizeTarget(B, [A, B, C]);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.appointmentId, B);
  });

  it("rejects invented UUID not in allowed", () => {
    const r = authorizeTarget(INVENTED, [A, B, C]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not_domain_reference");
  });

  it("rejects patient_id", () => {
    const r = authorizeTarget(PATIENT, [PATIENT, A], { patientId: PATIENT });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "from_patient_id");
  });
});

describe("resolveCancelAppointmentId (orchestrator)", () => {
  it("resolves list index via resolveReference", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      active_appointments: [A, B, C],
    };
    const r = resolveCancelAppointmentId({ appointment_id: "2" }, state);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.appointmentId, B);
  });

  it("falls back to focused when index is out of range", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: B,
      active_appointments: [A, B, C],
    };
    const r = resolveCancelAppointmentId({ appointment_id: "4" }, state);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.appointmentId, B);
  });

  it("uses focused when arg is empty", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: B,
      active_appointments: [A, B, C],
    };
    const r = resolveCancelAppointmentId({}, state);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.appointmentId, B);
  });

  it("rejects invented UUID (authorize), does not fall back to focused", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: B,
      active_appointments: [A, B, C],
    };
    const r = resolveCancelAppointmentId({ appointment_id: INVENTED }, state);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not_domain_reference");
  });

  it("errors on index 0 / -1 with no usable focused", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      active_appointments: [A, B, C],
    };
    assert.equal(resolveCancelAppointmentId({ appointment_id: "0" }, state).ok, false);
    assert.equal(resolveCancelAppointmentId({ appointment_id: "-1" }, state).ok, false);
  });
});

describe("focusedAfterAppointmentListRefresh", () => {
  it("focuses sole appointment when N=1", () => {
    assert.equal(focusedAfterAppointmentListRefresh([B], A), B);
  });

  it("preserves focus still in list when N>1", () => {
    assert.equal(focusedAfterAppointmentListRefresh([A, B, C], B), B);
  });

  it("clears focus missing from new list", () => {
    assert.equal(
      focusedAfterAppointmentListRefresh([A, C], B),
      undefined
    );
  });
});
