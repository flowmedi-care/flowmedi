import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantFaq, VirtualAssistantLocation, VirtualAssistantSettings } from "./types";
import { DAY_LABELS, type DayKey } from "./types";

type ClinicRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  services_pricing_mode: string | null;
};

type ProcedureRow = {
  id: string;
  name: string;
  duration_minutes: number | null;
  recommendations: string | null;
  default_service_id: string | null;
};

type ServiceRow = {
  id: string;
  nome: string;
  categoria: string | null;
};

type DoctorRow = {
  id: string;
  full_name: string;
  specialty: string | null;
};

function formatOperatingHours(
  hours: Record<string, { open?: string; close?: string; lunch_start?: string; lunch_end?: string; closed?: boolean }> | null
): string {
  if (!hours || Object.keys(hours).length === 0) return "Horário padrão da agenda da clínica.";
  const lines: string[] = [];
  for (const key of Object.keys(DAY_LABELS) as DayKey[]) {
    const day = hours[key];
    if (!day) continue;
    if (day.closed) {
      lines.push(`${DAY_LABELS[key]}: fechado`);
      continue;
    }
    let line = `${DAY_LABELS[key]}: ${day.open ?? "?"} às ${day.close ?? "?"}`;
    if (day.lunch_start && day.lunch_end) {
      line += ` (pausa almoço ${day.lunch_start}–${day.lunch_end})`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function formatPriceRange(vals: number[]): string {
  if (!vals.length) return "preço sob consulta";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return `R$ ${min.toFixed(2)}`;
  return `de R$ ${min.toFixed(2)} a R$ ${max.toFixed(2)}`;
}

function buildPriceByServiceId(prices: { service_id: string; valor: number }[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const p of prices) {
    const list = grouped.get(p.service_id) ?? [];
    list.push(Number(p.valor));
    grouped.set(p.service_id, list);
  }
  return grouped;
}

/** Apenas fatos da clínica — sem regras de comportamento. */
export async function buildClinicContext(
  supabase: SupabaseClient,
  clinicId: string
): Promise<{ text: string; clinicName: string; settings: Partial<VirtualAssistantSettings> }> {
  const [{ data: clinic }, { data: settings }, { data: faq }, { data: locations }] = await Promise.all([
    supabase
      .from("clinics")
      .select("name, phone, email, address, whatsapp_url, facebook_url, instagram_url, services_pricing_mode")
      .eq("id", clinicId)
      .single(),
    supabase.from("clinic_virtual_assistant_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
    supabase
      .from("clinic_virtual_assistant_faq")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("display_order"),
    supabase
      .from("clinic_virtual_assistant_locations")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("display_order"),
  ]);

  const c = (clinic ?? {}) as ClinicRow;
  const s = (settings ?? {}) as Partial<VirtualAssistantSettings>;
  const faqList = (faq ?? []) as VirtualAssistantFaq[];
  const locList = (locations ?? []) as VirtualAssistantLocation[];

  const [
    { data: doctors },
    { data: procedures },
    { data: services },
    { data: doctorProcedures },
    { data: servicePrices },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, specialty")
      .eq("clinic_id", clinicId)
      .eq("role", "medico")
      .order("full_name"),
    supabase
      .from("procedures")
      .select("id, name, duration_minutes, recommendations, default_service_id")
      .eq("clinic_id", clinicId)
      .order("display_order"),
    supabase.from("services").select("id, nome, categoria").eq("clinic_id", clinicId).order("nome"),
    supabase.from("doctor_procedures").select("doctor_id, procedure_id").eq("clinic_id", clinicId),
    supabase
      .from("service_prices")
      .select("id, service_id, valor, professional_id")
      .eq("clinic_id", clinicId)
      .eq("ativo", true),
  ]);

  const serviceMap = new Map((services ?? []).map((svc) => [svc.id, svc as ServiceRow]));
  const procedureMap = new Map((procedures ?? []).map((p) => [p.id, p as ProcedureRow]));
  const pricesByService = buildPriceByServiceId(
    (servicePrices ?? []).map((p) => ({ service_id: p.service_id, valor: Number(p.valor) }))
  );

  const procedureLines = (procedures ?? []).map((p) => {
    const proc = p as ProcedureRow;
    const mins = proc.duration_minutes ?? 30;
    const svc = proc.default_service_id ? serviceMap.get(proc.default_service_id) : null;
    const vals = proc.default_service_id ? pricesByService.get(proc.default_service_id) : undefined;
    const pricePart = vals?.length ? formatPriceRange(vals) : "preço sob consulta";
    const prep = proc.recommendations ? ` | Preparo: ${String(proc.recommendations).slice(0, 150)}` : "";
    const svcPart = svc ? ` | Serviço: ${svc.nome}` : "";
    return `- ${proc.name}: ~${mins} min | ${pricePart}${svcPart}${prep} [procedure_id: ${proc.id}]`;
  });

  const byDoctor = new Map<string, string[]>();
  for (const dp of doctorProcedures ?? []) {
    const procName = procedureMap.get(dp.procedure_id)?.name;
    if (!procName) continue;
    const list = byDoctor.get(dp.doctor_id) ?? [];
    list.push(procName);
    byDoctor.set(dp.doctor_id, list);
  }
  const doctorLines = (doctors ?? []).map((d) => {
    const doc = d as DoctorRow;
    const procs = byDoctor.get(doc.id);
    const spec = doc.specialty ? ` (${doc.specialty})` : "";
    const procText = procs?.length ? procs.join(", ") : "";
    return `- ${doc.full_name}${spec}${procText ? `: ${procText}` : ""} [doctor_id: ${doc.id}]`;
  });

  const locationLines = locList.map((l) => {
    const parts = [l.name];
    if (l.address) parts.push(l.address);
    if (l.google_maps_url) parts.push(l.google_maps_url);
    return parts.join(" | ");
  });

  const sections = [
    `# Dados da clínica (fatos — use ferramentas para valores/horários exatos)`,
    s.short_description ? `Sobre: ${s.short_description}` : "",
    c.address ? `Endereço: ${c.address}` : "",
    s.google_maps_url ? `Maps: ${s.google_maps_url}` : "",
    s.landmarks ? `Referências: ${s.landmarks}` : "",
    s.parking_info ? `Estacionamento: ${s.parking_info}` : "",
    c.phone ? `Tel: ${c.phone}` : "",
    c.email ? `E-mail: ${c.email}` : "",
  ];

  sections.push(`# Horários\n${formatOperatingHours(s.operating_hours as Record<string, { open?: string; close?: string; closed?: boolean }> | null)}`);
  if (s.payment_methods?.length) sections.push(`Formas de pagamento: ${s.payment_methods.join(", ")}`);
  if (s.cancellation_policy) sections.push(`Cancelamento: ${s.cancellation_policy}`);
  if (locList.length) sections.push(`# Unidades\n${locationLines.join("\n")}`);
  sections.push(`# Profissionais\n${doctorLines.join("\n") || "Nenhum."}`);
  sections.push(`# Procedimentos\n${procedureLines.join("\n") || "Nenhum."}`);
  if (faqList.length) {
    sections.push(`# FAQ\n${faqList.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")}`);
  }

  return {
    text: sections.filter(Boolean).join("\n\n"),
    clinicName: c.name ?? "clínica",
    settings: s,
  };
}
