import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { phonesMatch, normalizePhoneForMatch } from "../patient-lookup";

/** Domain: cancellable appointment statuses (backend gate). */
export function isCancellableAppointmentStatus(status: string): boolean {
  return status === "agendada" || status === "confirmada";
}

describe("cancel domain", () => {
  it("only agendada and confirmada are cancellable", () => {
    assert.equal(isCancellableAppointmentStatus("agendada"), true);
    assert.equal(isCancellableAppointmentStatus("confirmada"), true);
    assert.equal(isCancellableAppointmentStatus("realizada"), false);
    assert.equal(isCancellableAppointmentStatus("falta"), false);
    assert.equal(isCancellableAppointmentStatus("cancelada"), false);
  });

  it("phone normalize strips country code for storage", () => {
    assert.equal(normalizePhoneForMatch("5562986433345"), "62986433345");
    assert.equal(normalizePhoneForMatch("62986433345"), "62986433345");
  });

  it("phonesMatch treats 55-prefixed and national as same", () => {
    assert.equal(phonesMatch("62986433345", "5562986433345"), true);
    assert.equal(phonesMatch("5562986433345", "62986433345"), true);
  });
});
