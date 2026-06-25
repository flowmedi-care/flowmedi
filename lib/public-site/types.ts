import type { DayKey, OperatingHours } from "@/lib/virtual-assistant/types";

export type PublicSiteDoctor = {
  id: string;
  full_name: string;
  specialty: string | null;
  logo_url: string | null;
  logo_scale: number;
};

export type PublicSiteProcedure = {
  id: string;
  name: string;
  duration_minutes: number;
  doctor_ids: string[];
};

export type PublicSiteFaq = {
  id: string;
  question: string;
  answer: string;
};

export type PublicSiteLocation = {
  id: string;
  name: string;
  address: string | null;
  google_maps_url: string | null;
  phone: string | null;
  operating_hours: OperatingHours | null;
};

export type PublicSiteSettings = {
  site_enabled: boolean;
  self_service_booking_enabled: boolean;
  show_team: boolean;
  show_faq: boolean;
  show_services: boolean;
  hero_title: string | null;
  hero_subtitle: string | null;
  primary_color: string | null;
};

export type PublicClinicSite = {
  found: true;
  clinic_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  logo_scale: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email_branding_colors: Record<string, unknown> | null;
  site: PublicSiteSettings;
  short_description: string | null;
  google_maps_url: string | null;
  parking_info: string | null;
  accessibility_info: string | null;
  landmarks: string | null;
  operating_hours: OperatingHours;
  payment_methods: string[];
  cancellation_policy: string | null;
  active_promotions: string | null;
  has_multiple_units: boolean;
  doctors: PublicSiteDoctor[];
  procedures: PublicSiteProcedure[];
  faq: PublicSiteFaq[];
  locations: PublicSiteLocation[];
  has_active_rooms: boolean;
};

export type PublicClinicSiteResponse = PublicClinicSite | { found: false };

export const RESERVED_CLINIC_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "c",
  "f",
  "dashboard",
  "entrar",
  "criar-conta",
  "precos",
]);

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};
