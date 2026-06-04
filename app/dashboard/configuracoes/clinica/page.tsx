import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClinicInfoTabs } from "@/components/clinic-info/clinic-info-tabs";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseCustomLogo } from "@/lib/plan-gates";

export default async function ConfiguracoesClinicaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "name, logo_url, logo_scale, agenda_work_start, agenda_work_end, agenda_max_concurrent, phone, email, address, whatsapp_url, facebook_url, instagram_url"
    )
    .eq("id", profile.clinic_id)
    .single();

  const planData = await getClinicPlanData();
  const canUseCustomLogoByPlan = Boolean(
    planData &&
      canUseCustomLogo(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dados da clínica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nome, logo, horários da agenda, contato e redes sociais.
        </p>
      </div>
      <ClinicInfoTabs
        clinicId={profile.clinic_id}
        canUseCustomLogo={canUseCustomLogoByPlan}
        initialData={{
          name: clinic?.name ?? null,
          logoUrl: clinic?.logo_url ?? null,
          logoScale: clinic?.logo_scale ?? 100,
          agendaWorkStart: clinic?.agenda_work_start ?? "07:00:00",
          agendaWorkEnd: clinic?.agenda_work_end ?? "20:00:00",
          agendaMaxConcurrent: clinic?.agenda_max_concurrent ?? null,
          phone: clinic?.phone ?? null,
          email: clinic?.email ?? null,
          address: clinic?.address ?? null,
          whatsappUrl: clinic?.whatsapp_url ?? null,
          facebookUrl: clinic?.facebook_url ?? null,
          instagramUrl: clinic?.instagram_url ?? null,
        }}
      />
    </div>
  );
}
