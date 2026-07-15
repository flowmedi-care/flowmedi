import type { AppointmentPolicy, GoalPolicyLevel } from "@/lib/attendance-flow/types";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { financeDefaults } from "./defaults";
import type { FinanceSettings } from "./types";

function goal(
  policy: AppointmentPolicy,
  id: string,
  fallback: GoalPolicyLevel
): GoalPolicyLevel {
  const v = policy.goals[id];
  return v === "ignore" || v === "optional" || v === "required" ? v : fallback;
}

export function toFinanceSettings(
  policy: AppointmentPolicy,
  settings: Partial<VirtualAssistantSettings>
): FinanceSettings {
  const d = financeDefaults();
  return {
    insurance: goal(policy, "insurance", d.insurance),
    paymentMethod: goal(policy, "payment_method", d.paymentMethod),
    paymentMethodsText: (settings.payment_methods ?? []).join(", "),
    cancellationPolicyText: settings.cancellation_policy ?? "",
    avgWaitTime: settings.avg_wait_time ?? "",
    promotionsText: settings.active_promotions ?? "",
  };
}

export function financeToGoals(value: FinanceSettings): Record<string, GoalPolicyLevel> {
  return {
    insurance: value.insurance,
    payment_method: value.paymentMethod,
  };
}

export function financeToVaPatch(
  value: FinanceSettings
): Partial<VirtualAssistantSettings> {
  return {
    payment_methods: value.paymentMethodsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    cancellation_policy: value.cancellationPolicyText.trim() || null,
    avg_wait_time: value.avgWaitTime.trim() || null,
    active_promotions: value.promotionsText.trim() || null,
  };
}
