/**
 * Considerar "acesso Pro" apenas quando a clínica está no plano Pro
 * e a assinatura está ativa (não past_due, canceled ou unpaid).
 */
export function hasProAccess(planSlug: string | null, subscriptionStatus: string | null): boolean {
  return planSlug === "pro" && subscriptionStatus === "active";
}

export function canUseWhatsApp(planSlug: string | null, subscriptionStatus: string | null): boolean {
  return hasProAccess(planSlug, subscriptionStatus);
}
