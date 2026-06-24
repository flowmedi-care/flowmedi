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

function formatOperatingHours(hours: Record<string, { open?: string; close?: string; lunch_start?: string; lunch_end?: string; closed?: boolean }> | null): string {
  if (!hours || Object.keys(hours).length === 0) return "Use horário padrão da agenda da clínica.";
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

export async function buildKnowledgeContext(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string> {
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

  const [{ data: doctors }, { data: procedures }, { data: services }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("role", "medico")
      .order("full_name"),
    supabase
      .from("procedures")
      .select("id, name, duration_minutes, recommendations, default_service_id")
      .eq("clinic_id", clinicId)
      .order("display_order"),
    supabase.from("services").select("id, nome, ativo").eq("clinic_id", clinicId).eq("ativo", true),
  ]);

  const serviceIds = (services ?? []).map((svc) => svc.id);
  let priceSummary = "";
  if (serviceIds.length) {
    const { data: prices } = await supabase
      .from("service_prices")
      .select("service_id, valor, professional_id")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .in("service_id", serviceIds);

    const serviceMap = new Map((services ?? []).map((svc) => [svc.id, svc.nome]));
    const grouped = new Map<string, number[]>();
    for (const p of prices ?? []) {
      const name = serviceMap.get(p.service_id) ?? "Serviço";
      const list = grouped.get(name) ?? [];
      list.push(Number(p.valor));
      grouped.set(name, list);
    }
    priceSummary = [...grouped.entries()]
      .map(([name, vals]) => {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        return min === max ? `${name}: R$ ${min.toFixed(2)}` : `${name}: de R$ ${min.toFixed(2)} a R$ ${max.toFixed(2)}`;
      })
      .join("\n");
  }

  const tone = s.tone === "formal" ? "formal e respeitoso" : "informal e acolhedor";
  const emojiRule = s.use_emojis !== false ? "Pode usar emojis com moderação." : "Não use emojis.";

  const sections = [
    `# Identidade`,
    `Você é ${s.assistant_name ?? "o assistente virtual"} da ${c.name ?? "clínica"}.`,
    `Tom: ${tone}. ${emojiRule}`,
    s.short_description ? `Sobre: ${s.short_description}` : "",
    `Segmento: ${s.segment ?? "clínica"}`,

    `# Localização e contato`,
    c.address ? `Endereço: ${c.address}` : "",
    s.google_maps_url ? `Google Maps: ${s.google_maps_url}` : "",
    s.landmarks ? `Referências: ${s.landmarks}` : "",
    s.parking_info ? `Estacionamento: ${s.parking_info}` : "",
    s.accessibility_info ? `Acessibilidade: ${s.accessibility_info}` : "",
    c.phone ? `Telefone: ${c.phone}` : "",
    c.email ? `E-mail: ${c.email}` : "",
    s.website_url ? `Site: ${s.website_url}` : "",
    c.whatsapp_url ? `WhatsApp: ${c.whatsapp_url}` : "",
    c.instagram_url ? `Instagram: ${c.instagram_url}` : "",
    c.facebook_url ? `Facebook: ${c.facebook_url}` : "",

    `# Horários`,
    formatOperatingHours(s.operating_hours as Record<string, { open?: string; close?: string; lunch_start?: string; lunch_end?: string; closed?: boolean }> | null),
    s.holiday_policy ? `Feriados: ${s.holiday_policy}` : "",

    `# Políticas`,
    s.payment_methods?.length ? `Formas de pagamento: ${s.payment_methods.join(", ")}` : "",
    s.cancellation_policy ? `Cancelamento/reembolso: ${s.cancellation_policy}` : "",
    s.avg_wait_time ? `Tempo médio de espera: ${s.avg_wait_time}` : "",
    s.delivery_info ? `Delivery/entrega: ${s.delivery_info}` : "",
    s.booking_requires_appointment !== false ? "Agendamento é necessário para atendimento." : "",
    s.active_promotions ? `Promoções: ${s.active_promotions}` : "",

    locList.length
      ? `# Unidades\n${locList.map((l) => `- ${l.name}: ${l.address ?? ""} ${l.phone ? `Tel: ${l.phone}` : ""}`).join("\n")}`
      : "",

    `# Profissionais`,
    (doctors ?? []).map((d) => `- ${d.full_name} (id: ${d.id})`).join("\n") || "Nenhum médico cadastrado.",

    `# Procedimentos/serviços`,
    (procedures ?? [])
      .map((p) => {
        const rec = p.recommendations ? ` | Preparo: ${String(p.recommendations).slice(0, 200)}` : "";
        return `- ${p.name} (${p.duration_minutes ?? 30} min, id: ${p.id})${rec}`;
      })
      .join("\n") || "Nenhum procedimento cadastrado.",

    priceSummary ? `# Faixas de preço (consulte dimensões como convênio se necessário)\n${priceSummary}` : "",
    c.services_pricing_mode === "descentralizado"
      ? "Preços podem variar por profissional. Use a ferramenta get_service_price antes de informar valor exato."
      : "Use get_service_price para valores exatos quando o paciente perguntar preço.",

    faqList.length
      ? `# FAQ\n${faqList.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")}`
      : "",

    `# Regras de atendimento`,
    "- Respostas curtas (máx. 3 parágrafos), naturais para WhatsApp.",
    "- Se não souber, diga que vai verificar ou ofereça transferir para humano.",
    "- Nunca invente preços ou horários: use as ferramentas disponíveis.",
    "- Para agendar: confirme médico, procedimento, horário e dados do paciente.",
    "- Se pedirem atendente/humano/reclamação, use transfer_to_human.",
    s.human_handoff_enabled !== false
      ? "- Transferência humana disponível quando necessário."
      : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function buildBehaviorInstructions(settings: Partial<VirtualAssistantSettings>): string {
  const debounce = settings.message_debounce_seconds ?? 5;
  return [
    "Você está atendendo via WhatsApp.",
    `O paciente pode enviar várias mensagens seguidas; você recebe o lote após ~${debounce}s de pausa.`,
    "Responda de forma conversacional, como uma secretária experiente.",
    "Use listas numeradas ao oferecer opções de horário ou procedimento.",
    "Chame o paciente pelo primeiro nome quando souber.",
  ].join(" ");
}
