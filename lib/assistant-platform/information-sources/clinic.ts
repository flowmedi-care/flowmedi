import type { KnowledgeAcl } from "../knowledge-acl";
import type { FieldSpec, InformationSource, SourceLoadContext, StructuredSlice } from "./types";

export const clinicSource: InformationSource = {
  id: "clinic",
  displayName: "Clínica",
  editHref: "/dashboard/configuracoes/clinica",
  fields: (): FieldSpec[] => [
    { id: "address", label: "Endereço", aclKey: "address" },
    { id: "hours", label: "Horário", aclKey: "hours" },
    { id: "parking", label: "Estacionamento", aclKey: "parking" },
    { id: "accessibility", label: "Acessibilidade", aclKey: "accessibility" },
    { id: "units", label: "Unidades", aclKey: "units" },
    { id: "phones", label: "Telefones", aclKey: "phones" },
    { id: "social", label: "Redes sociais", aclKey: "social" },
    { id: "conventions", label: "Convênios", aclKey: "conventions" },
    { id: "promotions", label: "Promoções", aclKey: "promotions" },
    { id: "paymentMethods", label: "Formas de pagamento", aclKey: "paymentMethods" },
  ],
  async load(ctx: SourceLoadContext) {
    const [{ data: clinic }, { data: settings }, { data: locations }] = await Promise.all([
      ctx.supabase
        .from("clinics")
        .select("name, phone, email, address, whatsapp_url, facebook_url, instagram_url")
        .eq("id", ctx.clinicId)
        .single(),
      ctx.supabase
        .from("clinic_virtual_assistant_settings")
        .select(
          "short_description, google_maps_url, landmarks, parking_info, accessibility_info, operating_hours, payment_methods, active_promotions, cancellation_policy"
        )
        .eq("clinic_id", ctx.clinicId)
        .maybeSingle(),
      ctx.supabase
        .from("clinic_virtual_assistant_locations")
        .select("*")
        .eq("clinic_id", ctx.clinicId)
        .order("display_order"),
    ]);
    return { clinic, settings, locations: locations ?? [] };
  },
  buildContext(data, acl, neededPaths): StructuredSlice | null {
    if (!acl.clinic.enabled) return null;
    const f = acl.clinic.fields;
    const raw = data as {
      clinic: Record<string, unknown> | null;
      settings: Record<string, unknown> | null;
      locations: unknown[];
    };
    const slice: StructuredSlice = {};
    const c = raw.clinic ?? {};
    const s = raw.settings ?? {};
    const need = (path: string) =>
      neededPaths.length === 0 ||
      neededPaths.some((p) => p === path || p.startsWith("clinic."));

    if (f.address && need("clinic.address")) {
      if (c.address) slice.address = c.address;
      if (s.google_maps_url) slice.maps = s.google_maps_url;
      if (s.landmarks) slice.landmarks = s.landmarks;
      if (s.short_description) slice.about = s.short_description;
    }
    if (f.hours && need("clinic.hours") && s.operating_hours) {
      slice.hours = s.operating_hours;
    }
    if (f.parking && s.parking_info) slice.parking = s.parking_info;
    if (f.accessibility && s.accessibility_info) slice.accessibility = s.accessibility_info;
    if (f.units && need("clinic.units") && raw.locations?.length) slice.units = raw.locations;
    if (f.phones && c.phone) slice.phone = c.phone;
    if (f.phones && c.email) slice.email = c.email;
    if (f.social) {
      const social: Record<string, unknown> = {};
      if (c.whatsapp_url) social.whatsapp = c.whatsapp_url;
      if (c.facebook_url) social.facebook = c.facebook_url;
      if (c.instagram_url) social.instagram = c.instagram_url;
      if (Object.keys(social).length) slice.social = social;
    }
    if (f.paymentMethods && Array.isArray(s.payment_methods) && s.payment_methods.length) {
      slice.paymentMethods = s.payment_methods;
    }
    if (f.promotions && s.active_promotions) slice.promotions = s.active_promotions;
    if (f.conventions) {
      // placeholder until conventions module exists; cancellation often grouped nearby
      if (s.cancellation_policy) slice.cancellationPolicy = s.cancellation_policy;
    }
    return Object.keys(slice).length ? slice : null;
  },
};
