import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasPendingMutationOperation,
  resolveIntent,
  shouldSwitchWorkflow,
} from "@/lib/attendance-flow/intent-resolver";
import {
  mergeConversationFlows,
  DEFAULT_WORKFLOW_REMARCACAO,
  DEFAULT_WORKFLOW_CANCELAMENTO,
} from "@/lib/attendance-flow/defaults";
import { initConversationFlowState } from "@/lib/attendance-flow/engine";
import { initialAiState } from "@/lib/chatbot/state/types";
import {
  formatChatbotAiStateForPrompt,
  buildChatbotFallbackReply,
} from "@/lib/chatbot/state/format-for-prompt";
import { hydrateBookingFromAppointment } from "@/lib/chatbot/state/hydrate-booking-from-appointment";
import {
  resolveAvailableTools,
  syncFlowState,
} from "@/lib/attendance-flow/engine";
import { DEFAULT_APPOINTMENT_POLICY } from "@/lib/attendance-flow/defaults";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";

const APPT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DOCTOR = "82950bcf-2d9d-4760-a9a5-99a315ca3dd9";
const PROCEDURE = "490ed952-9e01-4ff7-b85c-0ab258017fa0";
const PATIENT = "1679cbdc-f69b-4f99-afb6-72f80caf5a14";

describe("intent sticky: remarcação não vira consulta por booking collecting", () => {
  it("hasPendingMutationOperation true com reschedule_booking pending", () => {
    const aiState = {
      ...initialAiState(),
      booking: { status: "collecting" as const, doctor_id: DOCTOR, procedure_id: PROCEDURE },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["slot_selected", "reschedule_booking"],
        satisfied: ["appointment_selected"],
      },
    };
    assert.equal(hasPendingMutationOperation(aiState), true);
  });

  it("após hydrate, isActiveBooking não resolve para consulta", () => {
    const aiState = {
      ...initialAiState(),
      focused_appointment_id: APPT,
      booking: { status: "collecting" as const, doctor_id: DOCTOR, procedure_id: PROCEDURE },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["slot_selected", "reschedule_booking"],
        satisfied: ["appointment_selected"],
      },
    };
    const r = resolveIntent({ userText: "Eai?", aiState });
    assert.equal(r.workflow_id, "reschedule");
    assert.equal(r.reason, "keep_active_workflow");
    assert.equal(shouldSwitchWorkflow("reschedule", r), false);
  });

  it("Dr daniel permanece em reschedule", () => {
    const aiState = {
      ...initialAiState(),
      focused_appointment_id: APPT,
      booking: { status: "collecting" as const, doctor_id: DOCTOR, procedure_id: PROCEDURE },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["slot_selected", "reschedule_booking"],
      },
    };
    const r = resolveIntent({ userText: "Dr daniel", aiState });
    assert.equal(r.workflow_id, "reschedule");
  });

  it("keyword remarcar ainda ativa reschedule", () => {
    const r = resolveIntent({
      userText: "Oi quero remarcar",
      aiState: initialAiState(),
    });
    assert.equal(r.workflow_id, "reschedule");
  });
});

describe("mergeConversationFlows pin estrutural", () => {
  it("stored scaffold booking_created não sobrescreve reschedule_booking", () => {
    const merged = mergeConversationFlows({
      workflows: {
        reschedule: {
          id: "reschedule",
          label: "Remarcação",
          mode: "assisted",
          goal_ids: ["appointment_selected", "slot_selected", "booking_created"],
          phases: [],
          enabled: false,
        },
      },
    });
    const wf = merged.workflows.reschedule!;
    assert.deepEqual(wf.goal_ids, DEFAULT_WORKFLOW_REMARCACAO.goal_ids);
    assert.ok(wf.goal_ids.includes("reschedule_booking"));
    assert.ok(!wf.goal_ids.includes("booking_created"));
    assert.equal(wf.enabled, true);
    assert.ok(wf.runtime?.resetSpec?.mutationKeys.includes("reschedule_booking"));
  });

  it("cancelamento também preserva goal_ids", () => {
    const merged = mergeConversationFlows({
      workflows: {
        cancelamento: {
          id: "cancelamento",
          label: "X",
          mode: "express",
          goal_ids: ["booking_created"],
          enabled: false,
        },
      },
    });
    assert.deepEqual(
      merged.workflows.cancelamento!.goal_ids,
      DEFAULT_WORKFLOW_CANCELAMENTO.goal_ids
    );
  });
});

describe("prompt / format remarcação hidratada", () => {
  it("pede só dia/horário e proíbe list_doctors", () => {
    const state = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      booking: {
        status: "collecting" as const,
        doctor_id: DOCTOR,
        procedure_id: PROCEDURE,
      },
      conversation_flow: {
        ...initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
        pending: ["slot_selected", "reschedule_booking"],
        satisfied: ["appointment_selected"],
      },
    };
    const text = formatChatbotAiStateForPrompt(state);
    assert.match(text, /NÃO pergunte médico/i);
    assert.match(text, /find_available_slots/i);
    assert.match(text, /reschedule_appointment/i);
    assert.doesNotMatch(text, /Médico AINDA NÃO selecionado/);
    assert.match(buildChatbotFallbackReply(state), /dia ou horário/i);
  });
});

describe("hydrate + tools remarcação", () => {
  it("hydrate preenche doctor/procedure; tools incluem reschedule_appointment", () => {
    const patch = hydrateBookingFromAppointment(
      { id: APPT, doctor_id: DOCTOR, procedure_id: PROCEDURE },
      initialAiState()
    );
    assert.equal(patch.booking?.doctor_id, DOCTOR);
    assert.equal(patch.booking?.procedure_id, PROCEDURE);

    const aiState = {
      ...initialAiState(),
      patient_id: PATIENT,
      focused_appointment_id: APPT,
      booking: {
        doctor_id: DOCTOR,
        procedure_id: PROCEDURE,
        pending_slot: "2026-07-20T15:00:00.000Z",
        status: "confirming" as const,
      },
    };
    const flowState = syncFlowState({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState: initConversationFlowState(DEFAULT_WORKFLOW_REMARCACAO),
    });
    assert.ok(flowState.satisfied.includes("appointment_selected"));
    assert.ok(flowState.satisfied.includes("slot_selected"));
    const tools = resolveAvailableTools({
      workflow: DEFAULT_WORKFLOW_REMARCACAO,
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      aiState,
      flowState,
    });
    assert.ok(
      tools.includes("reschedule_appointment"),
      `tools=${tools.join(",")}`
    );
    assert.ok(tools.includes("find_available_slots") || tools.includes("list_patient_appointments"));
    assert.ok(!tools.includes("create_appointment"));
  });
});
