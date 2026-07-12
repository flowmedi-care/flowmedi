import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateToolCall } from "../validators";
import { initialAiState } from "../../state/types";
import { applyReplyGuards } from "../reply-guards";
import { patchAiState, mergeAiState } from "../../state/patch";

describe("chatbot guardrails validators", () => {
  it("create_appointment exige patient_id", () => {
    const result = validateToolCall("create_appointment", {}, initialAiState(), {});
    assert.ok(result);
    assert.equal(result!.status, "needs_input");
  });

  it("register_patient exige full_name", () => {
    const result = validateToolCall("register_patient", {}, initialAiState(), {});
    assert.ok(result);
    assert.equal(result!.status, "needs_input");
  });

  it("find_available_slots exige doctor e procedure", () => {
    const result = validateToolCall("find_available_slots", {}, initialAiState(), {});
    assert.ok(result);
    assert.equal(result!.status, "needs_input");
  });

  it("find_available_slots rejeita doctor_id índice sem offered_doctors", () => {
    const result = validateToolCall(
      "find_available_slots",
      { doctor_id: "1", procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0" },
      {
        ...initialAiState(),
        booking: {
          procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0",
          status: "collecting",
        },
      },
      {}
    );
    assert.ok(result);
    assert.equal(result!.status, "needs_input");
    assert.match(String(result!.message ?? ""), /médico|list_doctors/i);
  });

  it("find_available_slots aceita doctor_id resolvido via offered_doctors índice", () => {
    const result = validateToolCall(
      "find_available_slots",
      { doctor_id: "1", procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0" },
      {
        ...initialAiState(),
        offered_doctors: [
          {
            id: "82950bcf-2d9d-4760-a9a5-99a315ca3dd9",
            name: "Daniel Medico",
            index: 1,
          },
        ],
        booking: {
          procedure_id: "490ed952-9e01-4ff7-b85c-0ab258017fa0",
          status: "collecting",
        },
      },
      {}
    );
    assert.equal(result, null);
  });
});

describe("chatbot reply guards", () => {
  it("bloqueia confirmação prematura", () => {
    const state = {
      ...initialAiState(),
      booking: { status: "collecting" as const },
    };
    const out = applyReplyGuards("Seu agendamento está confirmado!", state);
    assert.match(out, /finalizando/i);
    assert.doesNotMatch(out, /etapa:/i);
  });
});

describe("chatbot state patch", () => {
  it("lookup_patient atualiza patient_id", () => {
    const patch = patchAiState(
      "lookup_patient_by_phone",
      {},
      { status: "success", data: { patient_id: "p1" } },
      initialAiState()
    );
    assert.equal(patch.patient_id, "p1");
  });

  it("create_appointment marca booking done", () => {
    const current = {
      ...initialAiState(),
      booking: { status: "confirming" as const, procedure_id: "1" },
    };
    const next = mergeAiState(current, patchAiState(
      "create_appointment",
      {},
      { status: "success", data: { appointmentId: "a1" } },
      current
    ));
    assert.equal(next.booking?.status, "done");
  });

  it("missing reseta consecutive_tool_failures sem incrementar", () => {
    const current = { ...initialAiState(), consecutive_tool_failures: 2 };
    const patch = patchAiState(
      "find_available_slots",
      {},
      { status: "needs_input", missing: [{ field: "doctor_id" }], message: "Preciso do médico." },
      current
    );
    assert.equal(patch.consecutive_tool_failures, 0);
  });

  it("unavailable não incrementa consecutive_tool_failures", () => {
    const current = { ...initialAiState(), consecutive_tool_failures: 2 };
    const patch = patchAiState(
      "find_available_slots",
      {},
      { status: "unavailable", message: "Sem horários." },
      current
    );
    assert.equal(patch.consecutive_tool_failures, 0);
  });

  it("business error não incrementa consecutive_tool_failures", () => {
    const current = { ...initialAiState(), consecutive_tool_failures: 1 };
    const patch = patchAiState(
      "create_appointment",
      {},
      { status: "error", message: "CPF inválido." },
      current
    );
    assert.equal(patch.consecutive_tool_failures, 0);
  });

  it("infrastructure error incrementa consecutive_tool_failures", () => {
    const current = { ...initialAiState(), consecutive_tool_failures: 1 };
    const patch = patchAiState(
      "create_appointment",
      {},
      { status: "error", message: "timeout connecting to database" },
      current
    );
    assert.equal(patch.consecutive_tool_failures, 2);
  });

  it("list_doctors persiste offered_doctors", () => {
    const patch = patchAiState(
      "list_doctors",
      {},
      {
        status: "success",
        data: { doctors: [{ id: "d1", full_name: "Dr. A" }] },
        options: [{ id: "d1", label: "Dr. A", index: 1 }],
      },
      initialAiState()
    );
    assert.equal(patch.offered_doctors?.length, 1);
    assert.equal(patch.offered_doctors?.[0]?.id, "d1");
  });
});
