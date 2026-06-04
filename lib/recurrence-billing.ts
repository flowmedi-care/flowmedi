export type ServiceRecurrenceBillingMode = "per_session" | "treatment_plan" | null;

export function recurrenceBillingModeLabel(mode: ServiceRecurrenceBillingMode): string {
  if (mode === "per_session") return "Consultas independentes";
  if (mode === "treatment_plan") return "Plano de tratamento (pacote)";
  return "Não configurado (só agenda)";
}

export function serviceModeToRecurrenceBilling(
  mode: ServiceRecurrenceBillingMode
): "independent" | "treatment_plan" | null {
  if (mode === "per_session") return "independent";
  if (mode === "treatment_plan") return "treatment_plan";
  return null;
}
