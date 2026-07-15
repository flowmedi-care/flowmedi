import type { FinanceActions } from "@/lib/assistant-platform/finance-actions";
import { defaultFinanceActions } from "@/lib/assistant-platform/finance-actions";

export type FinanceActionSettings = FinanceActions;

export function financeActionDefaults(): FinanceActionSettings {
  return defaultFinanceActions();
}
