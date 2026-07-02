import type { SupabaseClient } from "@supabase/supabase-js";
import type { VirtualAssistantFaq, VirtualAssistantLocation, VirtualAssistantSettings } from "./types";
import { DAY_LABELS, type DayKey } from "./types";
import { buildResponseStyleBlock, getEmojiRule, getToneLabel } from "./response-style";

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

function formatPriceRange(vals: number[]): string {
  if (!vals.length) return "preço sob consulta";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (min === max) return `R$ ${min.toFixed(2)}`;
  return `de R$ ${min.toFixed(2)} a R$ ${max.toFixed(2)}`;
}

function buildPriceByServiceId(
  prices: { service_id: string; valor: number }[]
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const p of prices) {
    const list = grouped.get(p.service_id) ?? [];
    list.push(Number(p.valor));
    grouped.set(p.service_id, list);
  }
  return grouped;
}

function serviceHasDimensionPricing(
  serviceId: string,
  prices: { id: string; service_id: string }[],
  prdv: { service_price_id: string }[]
): boolean {
  const ruleIds = new Set(prices.filter((p) => p.service_id === serviceId).map((p) => p.id));
  return prdv.some((r) => ruleIds.has(r.service_price_id));
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

  const [
    { data: doctors },
    { data: procedures },
    { data: services },
    { data: doctorProcedures },
    { data: priceDimensions },
    { data: servicePrices },
    { data: prdv },
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
      .from("price_dimensions")
      .select("id, nome, dimension_values(id, valor, ativo)")
      .eq("clinic_id", clinicId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("service_prices")
      .select("id, service_id, valor, professional_id")
      .eq("clinic_id", clinicId)
      .eq("ativo", true),
    supabase.from("price_rule_dimension_values").select("service_price_id, dimension_value_id"),
  ]);

  const serviceMap = new Map((services ?? []).map((svc) => [svc.id, svc as ServiceRow]));
  const procedureMap = new Map((procedures ?? []).map((p) => [p.id, p as ProcedureRow]));
  const pricesByService = buildPriceByServiceId(
    (servicePrices ?? []).map((p) => ({ service_id: p.service_id, valor: Number(p.valor) }))
  );
  const allPrices = (servicePrices ?? []) as { id: string; service_id: string; valor: number }[];
  const allPrdv = (prdv ?? []) as { service_price_id: string; dimension_value_id: string }[];

  const procedureLines = (procedures ?? []).map((p) => {
    const proc = p as ProcedureRow;
    const mins = proc.duration_minutes ?? 30;
    const svc = proc.default_service_id ? serviceMap.get(proc.default_service_id) : null;
    const vals = proc.default_service_id ? pricesByService.get(proc.default_service_id) : undefined;
    let pricePart = "preço sob consulta";
    if (vals?.length) {
      pricePart = formatPriceRange(vals);
      if (proc.default_service_id && serviceHasDimensionPricing(proc.default_service_id, allPrices, allPrdv)) {
        pricePart += " (varia conforme convênio/opções — use list_price_options ou get_service_price)";
      }
    }
    const prep = proc.recommendations ? ` | Preparo: ${String(proc.recommendations).slice(0, 150)}` : "";
    const svcPart = svc ? ` | Serviço: ${svc.nome}` : "";
    return `- ${proc.name}: cerca de ${mins} min | ${pricePart}${svcPart}${prep} [procedure_id: ${proc.id}]`;
  });

  const serviceSummaryLines: string[] = [];
  for (const svc of services ?? []) {
    const vals = pricesByService.get(svc.id);
    if (!vals?.length) continue;
    const cat = svc.categoria ? ` (${svc.categoria})` : "";
    serviceSummaryLines.push(`- ${svc.nome}${cat}: ${formatPriceRange(vals)} [service_id: ${svc.id}]`);
  }

  const doctorProcedureLines: string[] = [];
  const byDoctor = new Map<string, string[]>();
  for (const dp of doctorProcedures ?? []) {
    const procName = procedureMap.get(dp.procedure_id)?.name;
    if (!procName) continue;
    const list = byDoctor.get(dp.doctor_id) ?? [];
    list.push(procName);
    byDoctor.set(dp.doctor_id, list);
  }
  for (const doc of (doctors ?? []) as DoctorRow[]) {
    const procs = byDoctor.get(doc.id);
    const spec = doc.specialty ? ` (${doc.specialty})` : "";
    const procText = procs?.length ? procs.join(", ") : "consulte procedimentos disponíveis";
    doctorProcedureLines.push(`- ${doc.full_name}${spec}: ${procText} [doctor_id: ${doc.id}]`);
  }

  const dimensionLines: string[] = [];
  for (const dim of priceDimensions ?? []) {
    const values = (dim.dimension_values as { id: string; valor: string; ativo: boolean }[] | null)?.filter(
      (v) => v.ativo !== false
    );
    if (!values?.length) continue;
    const opts = values.map((v) => `${v.valor} [dimension_value_id: ${v.id}]`).join(", ");
    dimensionLines.push(`- ${dim.nome}: ${opts}`);
  }

  const locationLines = locList.map((l) => {
    const parts = [`**${l.name}**`];
    if (l.address) parts.push(`Endereço: ${l.address}`);
    if (l.phone) parts.push(`Tel: ${l.phone}`);
    if (l.google_maps_url) parts.push(`Maps: ${l.google_maps_url}`);
    const hours = formatOperatingHours(l.operating_hours as Record<string, { open?: string; close?: string; closed?: boolean }>);
    if (hours && !hours.includes("horário padrão")) parts.push(`Horários:\n${hours}`);
    return parts.join("\n");
  });

  const tone = getToneLabel(s);
  const emojiRule = getEmojiRule(s);

  const sections = [
    `# Identidade`,
    `Você é ${s.assistant_name ?? "o assistente virtual"} da ${c.name ?? "clínica"}.`,
    `Tom: ${tone}. ${emojiRule}`,
    s.short_description ? `Sobre: ${s.short_description}` : "",
    `Segmento: ${s.segment ?? "clínica"}`,

    buildResponseStyleBlock(s),

    `# Localização e contato`,
    c.address ? `Endereço principal: ${c.address}` : "",
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

    `# Horários de atendimento`,
    formatOperatingHours(s.operating_hours as Record<string, { open?: string; close?: string; lunch_start?: string; lunch_end?: string; closed?: boolean }> | null),
    s.holiday_policy ? `Feriados: ${s.holiday_policy}` : "",

    `# Políticas`,
    s.payment_methods?.length ? `Formas de pagamento: ${s.payment_methods.join(", ")}` : "",
    s.cancellation_policy ? `Cancelamento/reembolso: ${s.cancellation_policy}` : "",
    s.avg_wait_time ? `Tempo médio de espera: ${s.avg_wait_time}` : "",
    s.delivery_info ? `Delivery/entrega: ${s.delivery_info}` : "",
    s.booking_requires_appointment !== false ? "Agendamento é necessário para atendimento." : "",
    s.active_promotions ? `Promoções: ${s.active_promotions}` : "",

    locList.length ? `# Unidades\n${locationLines.join("\n\n")}` : "",

    `# Profissionais`,
    (doctors ?? []).map((d) => `- ${d.full_name}${d.specialty ? ` (${d.specialty})` : ""} [doctor_id: ${d.id}]`).join("\n") ||
      "Nenhum médico cadastrado.",

    doctorProcedureLines.length ? `# Quem faz o quê\n${doctorProcedureLines.join("\n")}` : "",

    `# Procedimentos`,
    procedureLines.join("\n") || "Nenhum procedimento cadastrado.",

    serviceSummaryLines.length ? `# Serviços e faixas de preço\n${serviceSummaryLines.join("\n")}` : "",

    dimensionLines.length
      ? `# Opções de preço (convênio, turno, etc.)\nAo informar preço, pergunte qual opção se aplica. Use list_price_options ou get_service_price com dimension_value_ids.\n${dimensionLines.join("\n")}`
      : "",

    c.services_pricing_mode === "descentralizado"
      ? "Preços podem variar por profissional. Sempre informe doctor_id em get_service_price e list_price_options."
      : "Use get_service_price ou list_price_options para valores exatos quando o paciente perguntar preço.",

    faqList.length
      ? `# FAQ\n${faqList.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")}`
      : "",

    `# Regras de atendimento`,
    "- Respostas curtas (1–2 parágrafos na maioria dos casos), naturais para WhatsApp.",
    "- NUNCA mostre UUIDs ao paciente — use apenas nomes, datas e valores. IDs são só para ferramentas internas.",
    "- Se não souber, diga que vai verificar ou ofereça transferir para humano.",
    "- Nunca invente preços ou horários: use as ferramentas disponíveis.",
    "- Para agendar: procedimento → médico (se necessário) → horários → confirmar dados do paciente.",
    "- Para preço: use list_price_options ou get_service_price; se houver convênio, pergunte qual opção.",
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
    "Responda de forma conversacional, objetiva e específica — como uma secretária experiente da clínica.",
    "",
    "## Primeira mensagem ou saudação",
    "Cumprimente e ofereça um menu numerado curto, por exemplo:",
    "1) Agendar consulta/procedimento",
    "2) Valores e convênios",
    "3) Horários e localização",
    "4) Minhas consultas agendadas",
    "5) Falar com atendente",
    "",
    "## Fluxo de agendamento (uma pergunta por vez)",
    "1. Qual procedimento ou tipo de consulta?",
    "2. Com qual profissional? (se houver opção ou preferência)",
    "3. Mostre horários disponíveis (use find_available_slots) em lista numerada",
    "4. Confirme nome e dados; cadastre se necessário; crie o agendamento",
    "",
    "## Fluxo de preços",
    "1. Identifique o procedimento ou serviço",
    "2. Use list_price_options para mostrar opções (convênio etc.)",
    "3. Use get_service_price com dimension_value_ids para valor exato",
    "4. Apresente como R$ X,XX — nunca invente valores",
    "",
    "## Formatação",
    "- Listas numeradas ao oferecer opções",
    "- Uma pergunta por mensagem quando possível",
    "- Chame o paciente pelo primeiro nome quando souber",
    "- Valores sempre em reais (R$)",
  ].join("\n");
}
