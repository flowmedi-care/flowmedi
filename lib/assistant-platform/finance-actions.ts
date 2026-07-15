/** Financial *actions* only — no content. Prices live under services ACL + pricing capability. */

export type FinanceActions = {
  allowGenerateQuote: boolean;
  allowSendQuote: boolean;
  allowCalculateQuote: boolean;
};

export type FinanceActionsInput = Partial<FinanceActions>;

export function defaultFinanceActions(): FinanceActions {
  return {
    allowGenerateQuote: true,
    allowSendQuote: true,
    allowCalculateQuote: true,
  };
}

export function mergeFinanceActions(stored?: FinanceActionsInput | null): FinanceActions {
  const d = defaultFinanceActions();
  if (!stored) return d;
  return {
    allowGenerateQuote: stored.allowGenerateQuote ?? d.allowGenerateQuote,
    allowSendQuote: stored.allowSendQuote ?? d.allowSendQuote,
    allowCalculateQuote: stored.allowCalculateQuote ?? d.allowCalculateQuote,
  };
}
