import type {
  AppointmentPolicy,
  ConversationFlowsConfig,
  GoalPolicyLevel,
  WorkflowMode,
} from "@/lib/attendance-flow/types";
import { bookingDefaults } from "./defaults";
import type { BookingSettings } from "./types";

function goal(
  policy: AppointmentPolicy,
  id: string,
  fallback: GoalPolicyLevel
): GoalPolicyLevel {
  const v = policy.goals[id];
  return v === "ignore" || v === "optional" || v === "required" ? v : fallback;
}

export function policyToBookingSettings(
  policy: AppointmentPolicy,
  flows: ConversationFlowsConfig
): BookingSettings {
  const d = bookingDefaults();
  const consulta = flows.workflows.consulta;
  const reschedule = flows.workflows.reschedule;
  const cancel = flows.workflows.cancelamento;
  const mode = (consulta?.mode ?? d.mode) as WorkflowMode;

  return {
    allowBooking: consulta?.enabled !== false,
    allowReschedule: reschedule?.enabled !== false,
    allowCancellation: cancel?.enabled !== false,
    mode: mode === "express" || mode === "strict" ? mode : "assisted",
    patientInformation: {
      patient: goal(policy, "patient_identified", d.patientInformation.patient),
      cpf: goal(policy, "cpf", d.patientInformation.cpf),
      email: goal(policy, "email", d.patientInformation.email),
      guardian: goal(policy, "guardian", d.patientInformation.guardian),
    },
    appointmentInformation: {
      doctor: goal(policy, "doctor_selected", d.appointmentInformation.doctor),
      procedure: goal(policy, "procedure_selected", d.appointmentInformation.procedure),
      schedule: goal(policy, "slot_selected", d.appointmentInformation.schedule),
    },
    cancellationInformation: {
      reason: goal(policy, "cancel_reason", d.cancellationInformation.reason),
    },
  };
}

/** Goals patch derived from BookingSettings (domain id mapping). */
export function bookingSettingsToGoals(
  value: BookingSettings
): Record<string, GoalPolicyLevel> {
  return {
    patient_identified: value.patientInformation.patient,
    cpf: value.patientInformation.cpf,
    email: value.patientInformation.email,
    guardian: value.patientInformation.guardian,
    doctor_selected: value.appointmentInformation.doctor,
    procedure_selected: value.appointmentInformation.procedure,
    slot_selected: value.appointmentInformation.schedule,
    cancel_reason: value.cancellationInformation.reason,
  };
}

export function applyBookingToFlows(
  flows: ConversationFlowsConfig,
  value: BookingSettings
): ConversationFlowsConfig {
  const workflows = { ...flows.workflows };
  if (workflows.consulta) {
    workflows.consulta = {
      ...workflows.consulta,
      enabled: value.allowBooking,
      mode: value.mode,
    };
  }
  if (workflows.reschedule) {
    workflows.reschedule = {
      ...workflows.reschedule,
      enabled: value.allowReschedule,
    };
  }
  if (workflows.cancelamento) {
    workflows.cancelamento = {
      ...workflows.cancelamento,
      enabled: value.allowCancellation,
    };
  }
  return { workflows };
}
