/**
 * Clinic Policies — configuração por clínica (não misturar com Domain).
 */

export type ClinicPolicyConfig = {
  requireDeposit: boolean;
  requirePreConsultForm: boolean;
  autoOpenFinanceAfterConsult: boolean;
  phaseObjectives?: Partial<Record<string, string>>;
};

export const DEFAULT_CLINIC_POLICY: ClinicPolicyConfig = {
  requireDeposit: false,
  requirePreConsultForm: false,
  autoOpenFinanceAfterConsult: true,
};

export function resolveClinicPolicy(
  overrides?: Partial<ClinicPolicyConfig> | null
): ClinicPolicyConfig {
  return { ...DEFAULT_CLINIC_POLICY, ...overrides };
}
