import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplateEditor } from "../template-editor";
import { getMessageEvents } from "../../actions";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";

export default async function NovoTemplatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const eventsResult = await getMessageEvents();
  const events = eventsResult.data || [];
  const planData = await getClinicPlanData();
  const canUseEmailTemplates = Boolean(
    planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  const canUseWhatsAppTemplates = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );

  return (
    <TemplateEditor
      templateId={null}
      initialEventCode=""
      initialChannel="email"
      initialName=""
      initialSubject=""
      initialBodyHtml=""
      initialBodyText=""
      events={events}
      canUseEmailTemplates={canUseEmailTemplates}
      canUseWhatsAppTemplates={canUseWhatsAppTemplates}
    />
  );
}
