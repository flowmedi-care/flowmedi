import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ConfiguracoesClient } from "./configuracoes-client";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseCustomLogo, canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";

export default async function ConfiguracoesPage() {
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

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, logo_url, logo_scale, phone, email, address, whatsapp_url, facebook_url, instagram_url, compliance_confirmation_days, compliance_form_days, whatsapp_monthly_post24h_limit, auto_message_send_start, auto_message_send_end, auto_message_timezone, services_pricing_mode")
    .eq("id", profile.clinic_id)
    .single();
  const { data: reportGoals } = await supabase
    .from("clinic_report_goals")
    .select(
      "target_confirmation_pct,target_attendance_pct,target_no_show_pct,target_occupancy_pct,target_return_pct,return_window_days,working_hours_start,working_hours_end"
    )
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  const planData = await getClinicPlanData();
  const canUseWhatsAppByPlan = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );
  const canUseCustomLogoByPlan = Boolean(
    planData &&
      canUseCustomLogo(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  const canUseEmailByPlan = Boolean(
    planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );

  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ConfiguracoesClient
        clinicName={clinic?.name ?? null}
        clinicLogoUrl={clinic?.logo_url ?? null}
        clinicLogoScale={clinic?.logo_scale ?? 100}
        clinicPhone={clinic?.phone ?? null}
        clinicEmail={clinic?.email ?? null}
        clinicAddress={clinic?.address ?? null}
        clinicWhatsappUrl={clinic?.whatsapp_url ?? null}
        clinicFacebookUrl={clinic?.facebook_url ?? null}
        clinicInstagramUrl={clinic?.instagram_url ?? null}
        complianceConfirmationDays={clinic?.compliance_confirmation_days ?? null}
        complianceFormDays={clinic?.compliance_form_days ?? null}
        whatsappMonthlyPost24hLimit={clinic?.whatsapp_monthly_post24h_limit ?? null}
        autoMessageSendStart={clinic?.auto_message_send_start ?? "08:00:00"}
        autoMessageSendEnd={clinic?.auto_message_send_end ?? "20:00:00"}
        autoMessageTimezone={clinic?.auto_message_timezone ?? "America/Sao_Paulo"}
        servicesPricingMode={
          clinic?.services_pricing_mode === "centralizado" ? "centralizado" : "descentralizado"
        }
        reportGoals={{
          targetConfirmationPct: reportGoals?.target_confirmation_pct ?? 85,
          targetAttendancePct: reportGoals?.target_attendance_pct ?? 80,
          targetNoShowPct: reportGoals?.target_no_show_pct ?? 8,
          targetOccupancyPct: reportGoals?.target_occupancy_pct ?? 75,
          targetReturnPct: reportGoals?.target_return_pct ?? 60,
          returnWindowDays: reportGoals?.return_window_days ?? 30,
          workingHoursStart: reportGoals?.working_hours_start ?? 8,
          workingHoursEnd: reportGoals?.working_hours_end ?? 18,
        }}
        clinicId={profile.clinic_id}
        canUseWhatsApp={canUseWhatsAppByPlan}
        canUseEmail={canUseEmailByPlan}
        canUseCustomLogo={canUseCustomLogoByPlan}
      />
    </Suspense>
  );
}
