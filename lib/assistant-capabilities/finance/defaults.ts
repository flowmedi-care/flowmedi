import type { FinanceSettings } from "./types";

export function financeDefaults(): FinanceSettings {
  return {
    insurance: "optional",
    paymentMethod: "optional",
    paymentMethodsText: "",
    cancellationPolicyText: "",
    avgWaitTime: "",
    promotionsText: "",
  };
}
