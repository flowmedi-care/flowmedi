export type PricingStep = "select_service" | "present_quote";

export type PriceQuote = {
  amount: number;
  currency: string;
  breakdown?: string;
};

export type PricingDraft = {
  step: PricingStep;
  serviceId: string | null;
  quote: PriceQuote | null;
};

export function initialPricingDraft(): PricingDraft {
  return {
    step: "select_service",
    serviceId: null,
    quote: null,
  };
}

export function canAdvancePricingDraft(draft: PricingDraft): boolean {
  if (draft.step === "select_service") return draft.serviceId !== null;
  return draft.quote !== null;
}
