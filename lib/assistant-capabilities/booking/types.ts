import type { GoalPolicyLevel } from "@/lib/attendance-flow/types";

export type GoalLevel = GoalPolicyLevel;

export type BookingSettings = {
  allowBooking: boolean;
  allowReschedule: boolean;
  allowCancellation: boolean;
  mode: "express" | "assisted" | "strict";
  patientInformation: {
    patient: GoalLevel;
    cpf: GoalLevel;
    email: GoalLevel;
    guardian: GoalLevel;
  };
  appointmentInformation: {
    doctor: GoalLevel;
    procedure: GoalLevel;
    schedule: GoalLevel;
  };
  cancellationInformation: {
    reason: GoalLevel;
  };
};
