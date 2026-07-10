import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyBookingContinuity } from "../booking-continuity";
import { initialAiState } from "../state/types";

describe("chatbot booking continuity", () => {
  it("resolve seleção numérica de médico", () => {
    const state = {
      ...initialAiState(),
      offered_doctors: [
        { id: "doc-1", name: "Daniel Médico", index: 1 },
        { id: "doc-2", name: "Doc", index: 2 },
      ],
    };
    const result = applyBookingContinuity("2", state);
    assert.equal(result.statePatch.booking?.doctor_id, "doc-2");
  });

  it("resolve seleção numérica de procedimento", () => {
    const state = {
      ...initialAiState(),
      offered_procedures: [
        { id: "proc-1", name: "Endoscopia", index: 1 },
        { id: "proc-2", name: "Consulta", index: 2 },
      ],
    };
    const result = applyBookingContinuity("1", state);
    assert.equal(result.statePatch.booking?.procedure_id, "proc-1");
  });

  it("ignora mensagem não numérica sem contexto", () => {
    const result = applyBookingContinuity("quero agendar", initialAiState());
    assert.deepEqual(result.statePatch, {});
  });
});
