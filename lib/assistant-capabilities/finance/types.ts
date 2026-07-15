import type { GoalPolicyLevel } from "@/lib/attendance-flow/types";

export type FinanceSettings = {
  insurance: GoalPolicyLevel;
  paymentMethod: GoalPolicyLevel;
  paymentMethodsText: string;
  cancellationPolicyText: string;
  avgWaitTime: string;
  promotionsText: string;
};
