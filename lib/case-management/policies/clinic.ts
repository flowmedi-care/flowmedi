/**
 * Clinic Policies — configuração por clínica (não misturar com Domain).
 */

export type ClinicPolicyConfig = {
  requireDeposit: boolean;
  requirePreConsultForm: boolean;
  autoOpenFinanceAfterConsult: boolean;
  /** Se true, Appointment.Created → Decision confirm_slot */
  requireAppointmentConfirmation: boolean;
  phaseObjectives?: Partial<Record<string, string>>;
};

export const DEFAULT_CLINIC_POLICY: ClinicPolicyConfig = {
  requireDeposit: false,
  requirePreConsultForm: false,
  autoOpenFinanceAfterConsult: true,
  requireAppointmentConfirmation: true,
};

export function resolveClinicPolicy(
  overrides?: Partial<ClinicPolicyConfig> | null
): ClinicPolicyConfig {
  return { ...DEFAULT_CLINIC_POLICY, ...overrides };
}
