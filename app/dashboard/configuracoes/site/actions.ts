"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { gatherDataReadiness } from "@/lib/virtual-assistant/data-readiness";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getPublicSiteUrl, loadPublicClinicSite } from "@/lib/public-site/load-site";
import { getSubdomainSiteUrl } from "@/lib/public-site/host";

export type ClinicPublicSiteSettingsRow = {
  clinic_id: string;
  site_enabled: boolean;
  self_service_booking_enabled: boolean;
  show_team: boolean;
  show_faq: boolean;
  show_services: boolean;
  hero_title: string | null;
  hero_subtitle: string | null;
  primary_color: string | null;
  hero_image_url: string | null;
  mission: string | null;
  vision: string | null;
  values_text: string | null;
  show_contact_form: boolean;
  default_headline: string | null;
  default_subheadline: string | null;
  updated_at: string;
};

async function requireAdminClinic() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase: null, clinicId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores.", supabase: null, clinicId: null };
  }

  return { error: null, supabase, clinicId: profile.clinic_id };
}

export async function getPublicSitePageData() {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const [settingsRes, clinicRes, readiness] = await Promise.all([
    ctx.supabase
      .from("clinic_public_site_settings")
      .select("*")
      .eq("clinic_id", ctx.clinicId)
      .maybeSingle(),
    ctx.supabase.from("clinics").select("name, slug").eq("id", ctx.clinicId).single(),
    gatherDataReadiness(ctx.supabase, ctx.clinicId),
  ]);

  const slug = clinicRes.data?.slug ?? "";
  const siteUrl = slug ? getPublicSiteUrl(slug) : null;
  const subdomainUrl = slug ? getSubdomainSiteUrl(slug) : null;

  let bookingReadiness: { available: boolean; reason: string | null } = {
    available: false,
    reason: "Publique o site e ative o autoagendamento.",
  };

  if (settingsRes.data?.site_enabled && settingsRes.data?.self_service_booking_enabled && slug) {
    const siteData = await loadPublicClinicSite(slug);
    if (siteData.found) {
      bookingReadiness = checkPublicBookingReadiness(siteData);
    }
  }

  const { count: roomCount } = await ctx.supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", ctx.clinicId)
    .eq("active", true);

  return {
    error: null,
    settings: (settingsRes.data as ClinicPublicSiteSettingsRow | null) ?? null,
    clinicName: clinicRes.data?.name ?? "",
    slug,
    siteUrl,
    subdomainUrl,
    dataReadiness: readiness,
    bookingReadiness,
    hasActiveRooms: (roomCount ?? 0) > 0,
  };
}

export async function updatePublicSiteSettings(formData: FormData) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const siteEnabled = formData.get("site_enabled") === "true";
  const bookingEnabled = formData.get("self_service_booking_enabled") === "true";
  const showTeam = formData.get("show_team") !== "false";
  const showFaq = formData.get("show_faq") !== "false";
  const showServices = formData.get("show_services") !== "false";
  const heroTitle = String(formData.get("hero_title") ?? "").trim() || null;
  const heroSubtitle = String(formData.get("hero_subtitle") ?? "").trim() || null;
  const primaryColor = String(formData.get("primary_color") ?? "").trim() || null;
  const heroImageUrl = String(formData.get("hero_image_url") ?? "").trim() || null;
  const mission = String(formData.get("mission") ?? "").trim() || null;
  const vision = String(formData.get("vision") ?? "").trim() || null;
  const valuesText = String(formData.get("values_text") ?? "").trim() || null;
  const defaultHeadline = String(formData.get("default_headline") ?? "").trim() || null;
  const defaultSubheadline = String(formData.get("default_subheadline") ?? "").trim() || null;
  const showContactForm = formData.get("show_contact_form") !== "false";

  const payload = {
    clinic_id: ctx.clinicId,
    site_enabled: siteEnabled,
    self_service_booking_enabled: siteEnabled ? bookingEnabled : false,
    show_team: showTeam,
    show_faq: showFaq,
    show_services: showServices,
    hero_title: heroTitle,
    hero_subtitle: heroSubtitle,
    primary_color: primaryColor,
    hero_image_url: heroImageUrl,
    mission,
    vision,
    values_text: valuesText,
    show_contact_form: showContactForm,
    default_headline: defaultHeadline,
    default_subheadline: defaultSubheadline,
    updated_at: new Date().toISOString(),
  };

  const { error } = await ctx.supabase.from("clinic_public_site_settings").upsert(payload, {
    onConflict: "clinic_id",
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracoes/site");
  revalidatePath("/c/[slug]", "page");

  return { error: null };
}

async function uploadHeroToStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  clinicId: string
): Promise<{ url: string } | { error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `site-hero-${clinicId}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage.from("logos").upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: true,
  });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(path);

  return { url: publicUrl };
}

export async function uploadHeroImage(formData: FormData) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "Nenhum arquivo selecionado." };

  if (!file.type.startsWith("image/")) {
    return { error: "Selecione um arquivo de imagem (JPG, PNG ou WebP)." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "A imagem deve ter no máximo 5 MB." };
  }

  const uploadResult = await uploadHeroToStorage(ctx.supabase, file, ctx.clinicId);
  if ("error" in uploadResult) return uploadResult;

  const { error } = await ctx.supabase.from("clinic_public_site_settings").upsert(
    {
      clinic_id: ctx.clinicId,
      hero_image_url: uploadResult.url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracoes/site");
  revalidatePath("/c/[slug]", "page");

  return { error: null, url: uploadResult.url };
}

export async function clearHeroImage() {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const { error } = await ctx.supabase.from("clinic_public_site_settings").upsert(
    {
      clinic_id: ctx.clinicId,
      hero_image_url: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracoes/site");
  revalidatePath("/c/[slug]", "page");

  return { error: null };
}
