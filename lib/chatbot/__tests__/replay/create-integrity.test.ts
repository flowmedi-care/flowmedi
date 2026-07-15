import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSlotConfirmedRule,
  resolveDeterministicActions,
} from "../../agent/deterministic-actions";
import {
  buildCreateAppointmentArgsFromState,
  isOperationChangingTool,
  isTerminalMutationFailure,
  terminalMutationErrorMessage,
} from "../../agent/terminal-mutation";
import {
  BOOKING_FORK_PROMPT,
  resolveBookingForkChoice,
  shouldOfferBookingFork,
  shouldResolveBookingFork,
} from "../../agent/booking-fork";
import { extractPeriod } from "../../extractors/period";
import { patchAiState } from "../../state/patch";
import { initialAiState } from "../../state/types";
import { stampOfferedSlots } from "../../state/selection-context";

const PATIENT = "11111111-1111-1111-1111-111111111111";
const DOCTOR = "22222222-2222-2222-2222-222222222222";
const PROCEDURE = "33333333-3333-3333-3333-333333333333";
const SLOT = "2026-07-17T14:00:00.000Z";

function confirmingState() {
  const booking = stampOfferedSlots(
    {
      doctor_id: DOCTOR,
      procedure_id: PROCEDURE,
      date: "2026-07-17",
      status: "collecting",
    },
    [{ scheduled_at: SLOT, display: "14:00" }],
    {
      doctor_id: DOCTOR,
      procedure_id: PROCEDURE,
      date: "2026-07-17",
    },
    { pendingIfSingle: true }
  );
  return {
    ...initialAiState(),
    patient_id: PATIENT,
    booking,
    conversation_flow: {
      active_workflow_id: "consulta",
      mode: "assisted" as const,
      satisfied: [],
      pending: ["booking_created"],
      collected: {},
      current_operation: { status: "active" as const },
    },
  };
}

describe("create confirmed mutation", () => {
  it("create_slot_confirmed builds args only from domain state", () => {
    const after = confirmingState();
    const actions = resolveDeterministicActions({
      before: after,
      after,
      facts: { confirmed: true },
    });
    const create = actions.find((a) => a.reason === "create_slot_confirmed");
    assert.ok(create);
    assert.equal(create!.toolName, "create_appointment");
    assert.deepEqual(create!.args, {
      patient_id: PATIENT,
      doctor_id: DOCTOR,
      procedure_id: PROCEDURE,
      scheduled_at: SLOT,
    });
  });

  it("buildCreateAppointmentArgsFromState ignores LLM placeholders", () => {
    const state = confirmingState();
    const args = buildCreateAppointmentArgsFromState(state);
    assert.ok(args);
    assert.equal(args!.doctor_id, DOCTOR);
    assert.equal(args!.procedure_id, PROCEDURE);
    assert.notEqual(args!.doctor_id, "doc_id");
  });

  it("create_slot_confirmed rule matches confirming + Sim", () => {
    const after = confirmingState();
    assert.equal(
      createSlotConfirmedRule.matches({
        before: after,
        after,
        facts: { confirmed: true },
      }),
      true
    );
  });

  it("create error patch does not clear confirming + pending", () => {
    const current = confirmingState();
    const patch = patchAiState(
      "create_appointment",
      { doctor_id: "doc_id", procedure_id: "procedure_id" },
      {
        status: "error",
        message: "invalid input syntax for type uuid: \"doc_id\"",
      },
      current,
      "infrastructure"
    );
    // Infrastructure failures only bump consecutive failures — booking untouched.
    assert.equal(patch.booking, undefined);
    assert.equal(current.booking?.status, "confirming");
    assert.equal(current.booking?.pending_slot, SLOT);
  });

  it("create success patch marks done; error does not", () => {
    const ok = patchAiState(
      "create_appointment",
      {},
      { status: "success", data: { appointment_id: "appt-1", created: true } },
      confirmingState(),
      "success"
    );
    assert.equal(ok.booking?.status, "done");

    const failedBusiness = patchAiState(
      "create_appointment",
      {},
      { status: "error", message: "falhou" },
      confirmingState(),
      "business"
    );
    assert.equal(failedBusiness.booking, undefined);
  });

  it("after failed create fingerprint, Sim retries create_slot_confirmed", () => {
    const after = {
      ...confirmingState(),
      last_deterministic_action: {
        id: "create_slot_confirmed",
        fingerprint: [
          "create_slot_confirmed",
          PATIENT,
          DOCTOR,
          PROCEDURE,
          SLOT,
          String(confirmingState().booking?.selection_epoch ?? ""),
        ].join("|"),
        outcome: "blocked" as const,
      },
    };
    const actions = resolveDeterministicActions({
      before: after,
      after,
      facts: { confirmed: true },
    });
    assert.ok(actions.some((a) => a.reason === "create_slot_confirmed"));
  });
});

describe("atomic terminal mutation gate", () => {
  it("create failure is terminal mutation failure", () => {
    assert.equal(
      isTerminalMutationFailure(
        "create_appointment",
        "infrastructure",
        { status: "error" }
      ),
      true
    );
    assert.equal(
      isTerminalMutationFailure(
        "create_appointment",
        "success",
        { status: "success" }
      ),
      false
    );
  });

  it("list_patient_appointments is operation-changing after failure", () => {
    assert.equal(isOperationChangingTool("list_patient_appointments"), true);
    assert.equal(isOperationChangingTool("create_appointment"), true);
  });

  it("error reply offers retry without appointment list wording", () => {
    const msg = terminalMutationErrorMessage(
      "create_appointment",
      'invalid input syntax for type uuid: "doc_id"'
    );
    assert.match(msg, /Não consegui concluir o agendamento/i);
    assert.match(msg, /Sim/);
    assert.doesNotMatch(msg, /consultas futuras|lista/i);
  });
});

describe("extractPeriod amanhã ≠ manhã", () => {
  it("amanhã / amanha → no period", () => {
    assert.equal(extractPeriod("amanhã"), null);
    assert.equal(extractPeriod("amanha"), null);
    assert.equal(extractPeriod("para amanhã"), null);
  });

  it("de manhã / pela manhã → manha", () => {
    assert.equal(extractPeriod("de manhã"), "manha");
    assert.equal(extractPeriod("pela manhã"), "manha");
    assert.equal(extractPeriod("segunda de manhã"), "manha");
  });
});

describe("booking soft fork", () => {
  it("offers fork when starting booking with upcoming appts", () => {
    assert.equal(
      shouldOfferBookingFork(initialAiState(), 2, "quero agendar"),
      true
    );
    assert.equal(
      shouldOfferBookingFork(confirmingState(), 2, "quero agendar"),
      false
    );
  });

  it("resolves nova vs alterar", () => {
    assert.equal(resolveBookingForkChoice("quero nova"), "new");
    assert.equal(resolveBookingForkChoice("alterar a existente"), "alter");
    const awaiting = {
      ...initialAiState(),
      booking_fork: { status: "awaiting_choice" as const },
    };
    assert.equal(shouldResolveBookingFork(awaiting, "nova"), "new");
    assert.equal(shouldResolveBookingFork(awaiting, "alterar"), "alter");
    assert.equal(shouldResolveBookingFork(awaiting, "talvez"), "reprompt");
  });

  it("prompt is soft (no 1/2 menu)", () => {
    assert.match(BOOKING_FORK_PROMPT, /nova/i);
    assert.match(BOOKING_FORK_PROMPT, /alterar/i);
    assert.doesNotMatch(BOOKING_FORK_PROMPT, /\b1\b.*\b2\b/);
  });
});
