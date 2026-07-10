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
    assert.equal(result!.status, "missing");
  });

  it("register_patient exige full_name", () => {
    const result = validateToolCall("register_patient", {}, initialAiState(), {});
    assert.ok(result);
    assert.equal(result!.status, "missing");
  });

  it("find_available_slots exige doctor e procedure", () => {
    const result = validateToolCall("find_available_slots", {}, initialAiState(), {});
    assert.ok(result);
    assert.equal(result!.status, "missing");
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
      { status: "missing", missing: [{ field: "doctor_id" }], message: "Preciso do médico." },
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

  it("error incrementa consecutive_tool_failures", () => {
    const current = { ...initialAiState(), consecutive_tool_failures: 1 };
    const patch = patchAiState(
      "create_appointment",
      {},
      { status: "error", message: "Falha no sistema." },
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
