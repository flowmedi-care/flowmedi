export type BillingCycle = "monthly" | "annually";

export function parseBillingCycle(value: unknown): BillingCycle {
  if (value === "annually" || value === "annual" || value === "year" || value === "yearly") {
    return "annually";
  }
  return "monthly";
}

/**
 * Resolve the Stripe Price ID for a plan given the billing cycle.
 * Falls back: requested cycle → monthly → legacy stripe_price_id.
 */
export function resolveStripePriceId(
  plan: {
    stripe_price_id?: string | null;
    stripe_price_id_monthly?: string | null;
    stripe_price_id_annually?: string | null;
  },
  cycle: BillingCycle
): string | null {
  const monthly =
    plan.stripe_price_id_monthly?.trim() || plan.stripe_price_id?.trim() || null;
  const annually = plan.stripe_price_id_annually?.trim() || null;

  if (cycle === "annually") {
    return annually || monthly;
  }
  return monthly;
}

export function planHasAnnualPrice(plan: {
  stripe_price_id_annually?: string | null;
}): boolean {
  return Boolean(plan.stripe_price_id_annually?.trim());
}
