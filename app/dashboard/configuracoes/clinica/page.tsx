import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClinicInfoTabs } from "@/components/clinic-info/clinic-info-tabs";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseCustomLogo } from "@/lib/plan-gates";
import {
  DEFAULT_OPERATING_HOURS,
  type OperatingHours,
  type VirtualAssistantLocation,
} from "@/lib/virtual-assistant/types";

export default async function ConfiguracoesClinicaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [clinicRes, vaRes, siteRes, locRes] = await Promise.all([
    supabase
      .from("clinics")
      .select(
        "name, logo_url, logo_scale, agenda_work_start, agenda_work_end, agenda_max_concurrent, phone, email, address, whatsapp_url, facebook_url, instagram_url"
      )
      .eq("id", profile.clinic_id)
      .single(),
    supabase
      .from("clinic_virtual_assistant_settings")
      .select(
        "segment, short_description, google_maps_url, parking_info, accessibility_info, landmarks, has_multiple_units, operating_hours, holiday_policy, website_url"
      )
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle(),
    supabase
      .from("clinic_public_site_settings")
      .select("mission, vision, values_text")
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle(),
    supabase
      .from("clinic_virtual_assistant_locations")
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .order("display_order"),
  ]);

  const clinic = clinicRes.data;
  const va = vaRes.data;
  const site = siteRes.data;

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
          Informações institucionais, contato, localização, horários e identidade visual.
        </p>
      </div>
      <ClinicInfoTabs
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
          segment: va?.segment ?? null,
          shortDescription: va?.short_description ?? null,
          mission: site?.mission ?? null,
          vision: site?.vision ?? null,
          valuesText: site?.values_text ?? null,
          googleMapsUrl: va?.google_maps_url ?? null,
          parkingInfo: va?.parking_info ?? null,
          accessibilityInfo: va?.accessibility_info ?? null,
          landmarks: va?.landmarks ?? null,
          hasMultipleUnits: va?.has_multiple_units ?? false,
          operatingHours:
            (va?.operating_hours as OperatingHours | null) ?? DEFAULT_OPERATING_HOURS,
          holidayPolicy: va?.holiday_policy ?? null,
          websiteUrl: va?.website_url ?? null,
          locations: (locRes.data ?? []) as VirtualAssistantLocation[],
        }}
      />
    </div>
  );
}
