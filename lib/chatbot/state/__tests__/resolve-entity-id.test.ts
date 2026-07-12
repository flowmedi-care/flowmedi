import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveBookingEntityId } from "../resolve-entity-id";

describe("resolveBookingEntityId", () => {
  const doctors = [
    { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Daniel Medico", index: 1 },
    { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Doc", index: 2 },
  ];
  const patientId = "f2ed8c79-53e9-4fae-aa2c-96a0ee30cedf";

  it("resolves menu index via offered options", () => {
    const id = resolveBookingEntityId({
      arg: "1",
      stateId: undefined,
      offered: doctors,
      rejectId: patientId,
    });
    assert.equal(id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("keeps valid state UUID when arg is a bare index without offered", () => {
    const id = resolveBookingEntityId({
      arg: "1",
      stateId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      offered: undefined,
      rejectId: patientId,
    });
    assert.equal(id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("rejects patient_id when used as doctor_id", () => {
    const id = resolveBookingEntityId({
      arg: patientId,
      stateId: undefined,
      offered: doctors,
      rejectId: patientId,
    });
    assert.equal(id, "");
  });

  it("resolves procedure slug via offered name", () => {
    const procedures = [
      { id: "proc-endo", name: "Endoscopia", index: 1 },
      { id: "proc-ret", name: "Retorno", index: 2 },
    ];
    const id = resolveBookingEntityId({
      arg: "endoscopia",
      offered: procedures,
    });
    assert.equal(id, "proc-endo");
  });

  it("does not persist bare index as id", () => {
    const id = resolveBookingEntityId({
      arg: "1",
      stateId: "1",
      offered: undefined,
    });
    assert.equal(id, "");
  });
});
