import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicClinicSite, PublicClinicSiteResponse } from "./types";

function parseSiteData(raw: Record<string, unknown>): PublicClinicSite {
  const site = raw.site as Record<string, unknown>;
  return {
    found: true,
    clinic_id: String(raw.clinic_id),
    slug: String(raw.slug),
    name: String(raw.name),
    logo_url: (raw.logo_url as string | null) ?? null,
    logo_scale: Number(raw.logo_scale) || 100,
    phone: (raw.phone as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    whatsapp_url: (raw.whatsapp_url as string | null) ?? null,
    facebook_url: (raw.facebook_url as string | null) ?? null,
    instagram_url: (raw.instagram_url as string | null) ?? null,
    email_branding_colors: (raw.email_branding_colors as Record<string, unknown> | null) ?? null,
    site: {
      site_enabled: Boolean(site.site_enabled),
      self_service_booking_enabled: Boolean(site.self_service_booking_enabled),
      show_team: site.show_team !== false,
      show_faq: site.show_faq !== false,
      show_services: site.show_services !== false,
      hero_title: (site.hero_title as string | null) ?? null,
      hero_subtitle: (site.hero_subtitle as string | null) ?? null,
      primary_color: (site.primary_color as string | null) ?? null,
    },
    short_description: (raw.short_description as string | null) ?? null,
    google_maps_url: (raw.google_maps_url as string | null) ?? null,
    parking_info: (raw.parking_info as string | null) ?? null,
    accessibility_info: (raw.accessibility_info as string | null) ?? null,
    landmarks: (raw.landmarks as string | null) ?? null,
    operating_hours: (raw.operating_hours as PublicClinicSite["operating_hours"]) ?? {},
    payment_methods: Array.isArray(raw.payment_methods) ? (raw.payment_methods as string[]) : [],
    cancellation_policy: (raw.cancellation_policy as string | null) ?? null,
    active_promotions: (raw.active_promotions as string | null) ?? null,
    has_multiple_units: Boolean(raw.has_multiple_units),
    doctors: Array.isArray(raw.doctors) ? (raw.doctors as PublicClinicSite["doctors"]) : [],
    procedures: Array.isArray(raw.procedures) ? (raw.procedures as PublicClinicSite["procedures"]) : [],
    faq: Array.isArray(raw.faq) ? (raw.faq as PublicClinicSite["faq"]) : [],
    locations: Array.isArray(raw.locations) ? (raw.locations as PublicClinicSite["locations"]) : [],
    has_active_rooms: Boolean(raw.has_active_rooms),
  };
}

export async function loadPublicClinicSite(slug: string): Promise<PublicClinicSiteResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_clinic_site", {
    p_slug: slug,
  });

  if (error || !data || !data.found) {
    return { found: false };
  }

  return parseSiteData(data as Record<string, unknown>);
}

export async function loadPublicClinicSiteWithServiceRole(
  supabase: SupabaseClient,
  slug: string
): Promise<PublicClinicSiteResponse> {
  const { data, error } = await supabase.rpc("get_public_clinic_site", {
    p_slug: slug,
  });

  if (error || !data || !(data as { found?: boolean }).found) {
    return { found: false };
  }

  return parseSiteData(data as Record<string, unknown>);
}

export function getHeroTitle(site: PublicClinicSite): string {
  return site.site.hero_title?.trim() || site.name;
}

export function getHeroSubtitle(site: PublicClinicSite): string | null {
  return site.site.hero_subtitle?.trim() || site.short_description;
}

export function getPublicSiteUrl(slug: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://flowmedi.com.br";
  return `${base.replace(/\/$/, "")}/c/${slug}`;
}
