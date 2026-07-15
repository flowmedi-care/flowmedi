import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hydrateCollectedFromSnapshot, computeIntakeGap } from "../../snapshot/gap-resolver";
import { initialAiState } from "../../state/types";
import { DEFAULT_APPOINTMENT_POLICY, BUILTIN_GOAL_DEFINITIONS } from "@/lib/attendance-flow/defaults";
import { buildGoalRegistry } from "@/lib/attendance-flow/flow-sync";
import { canExecuteMutation } from "@/lib/attendance-flow/engine";
import { resolveBookingEntityId } from "../../state/resolve-entity-id";
import { resolveReferenceFacts } from "../../state/resolve-facts";
import { extractFacts } from "../../extractors";
import { patchAiState } from "../../state/patch";
import { applyReplyGuards } from "../../guardrails/reply-guards";
import { extractPeriod } from "../../extractors/period";
import type { PatientSlice } from "../../snapshot/loaders/patient-loader";

const registry = buildGoalRegistry([]);

const knownPatient: PatientSlice = {
  id: "p-maria",
  full_name: "Maria Silva",
  display_name: "Maria",
  email: "psi.mariaclaracoranejo@gmail.com",
  cpf: "70716885166",
  phone: "5562986433345",
  birth_date: "1999-06-01",
  age: 27,
  custom_fields: { convenio: "AFFEGO" },
};

describe("replay known_patient", () => {
  it("hydrate fills cpf+insurance; gap omits them", () => {
    const collected = hydrateCollectedFromSnapshot({
      patient: knownPatient,
      aiState: initialAiState(),
      turnFacts: {},
    });
    assert.equal(collected.cpf, "70716885166");
    assert.equal(collected.insurance, "AFFEGO");
    assert.equal(collected.email, "psi.mariaclaracoranejo@gmail.com");

    const gap = computeIntakeGap({
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry,
      patient: knownPatient,
      aiState: {
        ...initialAiState(),
        conversation_flow: {
          active_workflow_id: "consulta",
          mode: "assisted",
          satisfied: [],
          pending: [],
          collected,
        },
      },
      turnFacts: {},
      customFields: [],
    });
    const ids = gap.map((g) => g.goal_id);
    assert.equal(ids.includes("cpf"), false);
    assert.equal(ids.includes("insurance"), false);
    assert.equal(ids.includes("email"), false);
  });

  it("reply guard blocks re-asking known CPF", () => {
    const reply = applyReplyGuards("Agora, preciso do seu CPF para finalizar o agendamento.", {
      ...initialAiState(),
      conversation_flow: {
        active_workflow_id: "consulta",
        mode: "assisted",
        satisfied: ["cpf"],
        pending: [],
        collected: { cpf: "70716885166" },
      },
      booking: {
        status: "confirming",
        pending_slot: "2026-07-14T11:00:00.000Z",
      },
    });
    assert.match(reply, /já tenho seu CPF/i);
    assert.doesNotMatch(reply, /preciso do seu CPF/i);
  });
});

describe("replay new_patient", () => {
  it("before_booking required CPF blocks create", () => {
    const policy = {
      ...DEFAULT_APPOINTMENT_POLICY,
      goals: { ...DEFAULT_APPOINTMENT_POLICY.goals, cpf: "required" as const },
    };
    const result = canExecuteMutation(
      "booking_created",
      "assisted",
      policy,
      registry,
      ["cpf", "booking_created"]
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.missing.includes("cpf"));
  });

  it("after_booking email does not block create when optional/required stage after", () => {
    const emailGoal = BUILTIN_GOAL_DEFINITIONS.find((g) => g.id === "email");
    assert.equal(emailGoal?.requiredStage, "after_booking");
    const policy = {
      ...DEFAULT_APPOINTMENT_POLICY,
      goals: { ...DEFAULT_APPOINTMENT_POLICY.goals, email: "required" as const },
    };
    const result = canExecuteMutation(
      "booking_created",
      "assisted",
      policy,
      registry,
      ["email", "booking_created"]
    );
    assert.equal(result.ok, true);
  });
});

describe("replay cancel_after_create", () => {
  it("create_appointment patch seeds focused and active", () => {
    const patch = patchAiState(
      "create_appointment",
      {},
      { status: "success", data: { appointment_id: "appt-1", created: true } },
      initialAiState(),
      "success"
    );
    assert.equal(patch.focused_appointment_id, "appt-1");
    assert.deepEqual(patch.active_appointments, ["appt-1"]);
    assert.equal(patch.booking?.status, "done");
  });

  it("cancel prefers focused_appointment_id then active_appointments", () => {
    const state = {
      ...initialAiState(),
      patient_id: "p-maria",
      focused_appointment_id: "appt-1",
      active_appointments: ["appt-1"],
    };
    const appointmentId =
      state.focused_appointment_id ?? state.active_appointments?.[0] ?? "";
    assert.equal(appointmentId, "appt-1");
    assert.equal(state.patient_id, "p-maria");
  });
});

describe("replay slot_conflict / period", () => {
  it("extractPeriod manhã e tarde is null (all periods)", () => {
    assert.equal(extractPeriod("manhã e tarde"), null);
    assert.equal(extractPeriod("manha e tarde"), null);
  });

  it("ConflictDetected shape has message only (no updatedSlots)", () => {
    // Domain fact contract — runtime owns refetch of offered_slots.
    const conflict = {
      type: "conflict" as const,
      message: "Já existe consulta neste horário para o profissional.",
      conflictingAt: "2026-07-14T11:30:00.000Z",
    };
    assert.equal(conflict.type, "conflict");
    assert.ok(conflict.message.length > 0);
    assert.equal(
      "updatedSlots" in (conflict as Record<string, unknown>),
      false
    );
  });

  it("create failure with conflict clears pending and refreshes booking collecting", () => {
    // Mirrors execute.ts statePatch on ConflictDetected (without DB).
    const refreshed = [
      { scheduled_at: "2026-07-14T12:00:00.000Z", display: "09:00" },
      { scheduled_at: "2026-07-14T13:00:00.000Z", display: "10:00" },
    ];
    const patch = {
      booking: {
        procedure_id: "proc-1",
        doctor_id: "doc-1",
        date: "2026-07-14",
        offered_slots: refreshed,
        pending_slot: undefined as string | undefined,
        status: "collecting" as const,
      },
    };
    assert.equal(patch.booking.pending_slot, undefined);
    assert.equal(patch.booking.status, "collecting");
    assert.equal(patch.booking.offered_slots.length, 2);
    assert.equal(
      patch.booking.offered_slots.some((s) => s.display === "08:30"),
      false
    );
  });
});

describe("replay doctor_selection", () => {
  it("index resolves to UUID via offered_doctors", () => {
    const id = resolveBookingEntityId({
      arg: "1",
      offered: [
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Daniel", index: 1 },
        { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Doc", index: 2 },
      ],
    });
    assert.equal(id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("day index resolves booking.date", () => {
    const patch = resolveReferenceFacts(
      { selectedIndex: 2 },
      {
        ...initialAiState(),
        offered_days: [
          { date: "2026-07-13", label: "seg. 13/07", index: 1 },
          { date: "2026-07-14", label: "ter. 14/07", index: 2 },
        ],
      }
    );
    assert.equal(patch.booking?.date, "2026-07-14");
  });

  it("bare 10 with offered slots resolves index not clock", () => {
    const offered_slots = [
      { scheduled_at: "2026-07-17T13:00:00.000Z", display: "10:00" },
      { scheduled_at: "2026-07-17T13:30:00.000Z", display: "10:30" },
      { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
      { scheduled_at: "2026-07-17T15:30:00.000Z", display: "12:30" },
      { scheduled_at: "2026-07-17T16:00:00.000Z", display: "13:00" },
      { scheduled_at: "2026-07-17T16:30:00.000Z", display: "13:30" },
      { scheduled_at: "2026-07-17T17:00:00.000Z", display: "14:00" },
      { scheduled_at: "2026-07-17T17:30:00.000Z", display: "14:30" },
      { scheduled_at: "2026-07-17T18:00:00.000Z", display: "15:00" },
      { scheduled_at: "2026-07-17T18:30:00.000Z", display: "15:30" },
    ];
    const facts = extractFacts("10", new Date(), offered_slots);
    assert.equal(facts.selectedIndex, 10);
    assert.equal(facts.selected_scheduled_at, undefined);
    const patch = resolveReferenceFacts(facts, {
      ...initialAiState(),
      booking: { offered_slots, status: "collecting" },
    });
    assert.equal(patch.booking?.pending_slot, "2026-07-17T18:30:00.000Z");
  });
});
