import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";

export async function assertEmailFeatureAccessForCurrentClinic(): Promise<{
  allowed: boolean;
  error: string | null;
}> {
  const planData = await getClinicPlanData();
  const allowed = Boolean(
    planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  return {
    allowed,
    error: allowed ? null : "Recurso de e-mail indisponível no plano atual.",
  };
}

export async function assertWhatsAppFeatureAccessForCurrentClinic(): Promise<{
  allowed: boolean;
  error: string | null;
}> {
  const planData = await getClinicPlanData();
  const allowed = Boolean(planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus));
  return {
    allowed,
    error: allowed ? null : "Recurso de WhatsApp indisponível no plano atual.",
  };
}
