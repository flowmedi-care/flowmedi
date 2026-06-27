"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { renderQuoteHtml } from "@/lib/quotes/render-quote";
import {
  DEFAULT_QUOTE_TERMS,
  type QuoteDetail,
  type QuoteInput,
  type QuoteItemInput,
  type QuoteListItem,
  type QuoteStatus,
} from "@/lib/quotes/types";

const REVALIDATE_PATHS = ["/dashboard/vendas/orcamentos"];

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, profile: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", supabase, profile: null, userId: user.id };
  }

  return { error: null, supabase, profile, userId: user.id };
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function computeTotals(items: QuoteItemInput[], discountAmount: number) {
  const billable = items.filter((i) => !(i.section === "materials" && i.bill_separately));
  const subtotal = billable.reduce((s, i) => s + Number(i.total_price), 0);
  const separateMaterials = items
    .filter((i) => i.section === "materials" && i.bill_separately)
    .reduce((s, i) => s + Number(i.total_price), 0);
  const total = Math.max(0, subtotal - discountAmount) + separateMaterials;
  return { subtotal, total };
}

function validateRecipient(input: QuoteInput): string | null {
  const hasPatient = !!input.patient_id;
  const hasLead = !!input.pipeline_id;
  const hasStandalone = !!input.recipient_name?.trim();
  if (!hasPatient && !hasLead && !hasStandalone) {
    return "Informe um paciente, lead ou nome do destinatário.";
  }
  return null;
}

async function nextQuoteNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string
): Promise<number> {
  const { data } = await supabase
    .from("quotes")
    .select("quote_number")
    .eq("clinic_id", clinicId)
    .order("quote_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.quote_number ?? 0) + 1;
}

function mapQuoteDetail(raw: Record<string, unknown>): QuoteDetail {
  const patient = unwrapRelation(raw.patient as { full_name?: string } | null);
  const pipeline = unwrapRelation(raw.pipeline as { name?: string; email?: string } | null);
  const professional = unwrapRelation(
    raw.professional as { full_name?: string | null } | null
  );
  const items = ((raw.quote_items as Record<string, unknown>[]) ?? [])
    .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
    .map((item) => ({
      id: item.id as string,
      item_type: item.item_type as QuoteItemInput["item_type"],
      reference_id: (item.reference_id as string | null) ?? null,
      description: item.description as string,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      section: item.section as QuoteItemInput["section"],
      bill_separately: Boolean(item.bill_separately),
      display_order: Number(item.display_order ?? 0),
    }));

  return {
    id: raw.id as string,
    quote_number: Number(raw.quote_number),
    clinic_id: raw.clinic_id as string,
    patient_id: (raw.patient_id as string | null) ?? null,
    pipeline_id: (raw.pipeline_id as string | null) ?? null,
    recipient_name: (raw.recipient_name as string | null) ?? null,
    recipient_phone: (raw.recipient_phone as string | null) ?? null,
    recipient_email: (raw.recipient_email as string | null) ?? null,
    professional_id: (raw.professional_id as string | null) ?? null,
    professional_name: professional?.full_name ?? null,
    status: raw.status as QuoteStatus,
    valid_until: (raw.valid_until as string | null) ?? null,
    subtotal: Number(raw.subtotal),
    discount_amount: Number(raw.discount_amount),
    total_amount: Number(raw.total_amount),
    notes: (raw.notes as string | null) ?? null,
    terms: (raw.terms as string | null) ?? null,
    sent_at: (raw.sent_at as string | null) ?? null,
    accepted_at: (raw.accepted_at as string | null) ?? null,
    created_at: raw.created_at as string,
    items,
    patient_name: patient?.full_name ?? null,
    pipeline_name: pipeline?.name ?? pipeline?.email ?? null,
  };
}

function recipientDisplay(q: QuoteDetail): string {
  return q.patient_name ?? q.pipeline_name ?? q.recipient_name ?? "—";
}

async function fetchQuoteById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  id: string
): Promise<{ error: string | null; data: QuoteDetail | null }> {
  const { data, error } = await supabase
    .from("quotes")
    .select(
      `
      *,
      patient:patients ( full_name ),
      pipeline:non_registered_pipeline ( name, email ),
      professional:profiles!professional_id ( full_name ),
      quote_items ( * )
    `
    )
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) return { error: error.message, data: null };
  if (!data) return { error: "Orçamento não encontrado.", data: null };
  return { error: null, data: mapQuoteDetail(data as Record<string, unknown>) };
}

export async function listQuotes(): Promise<{
  error: string | null;
  data: QuoteListItem[];
}> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] };

  const { data, error } = await ctx.supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status, total_amount, valid_until, created_at, sent_at,
      recipient_name,
      patient:patients ( full_name ),
      pipeline:non_registered_pipeline ( name, email )
    `
    )
    .eq("clinic_id", ctx.profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };

  const today = new Date().toISOString().slice(0, 10);
  const rows: QuoteListItem[] = (data ?? []).map((row) => {
    const patient = unwrapRelation(row.patient as { full_name?: string } | null);
    const pipeline = unwrapRelation(row.pipeline as { name?: string; email?: string } | null);
    let status = row.status as QuoteStatus;
    if (
      status === "enviado" &&
      row.valid_until &&
      row.valid_until < today
    ) {
      status = "expirado";
    }
    return {
      id: row.id,
      quote_number: row.quote_number,
      status,
      recipient_display:
        patient?.full_name ?? pipeline?.name ?? pipeline?.email ?? row.recipient_name ?? "—",
      total_amount: Number(row.total_amount),
      valid_until: row.valid_until,
      created_at: row.created_at,
      sent_at: row.sent_at,
    };
  });

  return { error: null, data: rows };
}

export async function getQuote(id: string): Promise<{
  error: string | null;
  data: QuoteDetail | null;
}> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: null };
  return fetchQuoteById(ctx.supabase, ctx.profile.clinic_id, id);
}

export async function createQuote(input: QuoteInput): Promise<{
  error: string | null;
  id: string | null;
}> {
  const recipientError = validateRecipient(input);
  if (recipientError) return { error: recipientError, id: null };
  if (!input.items.length) return { error: "Adicione ao menos um item.", id: null };

  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile || !ctx.userId) return { error: ctx.error, id: null };

  const discount = Number(input.discount_amount ?? 0);
  const { subtotal, total } = computeTotals(input.items, discount);
  const quoteNumber = await nextQuoteNumber(ctx.supabase, ctx.profile.clinic_id);

  const { data: quote, error } = await ctx.supabase
    .from("quotes")
    .insert({
      clinic_id: ctx.profile.clinic_id,
      quote_number: quoteNumber,
      patient_id: input.patient_id || null,
      pipeline_id: input.pipeline_id || null,
      recipient_name: input.recipient_name?.trim() || null,
      recipient_phone: input.recipient_phone?.trim() || null,
      recipient_email: input.recipient_email?.trim() || null,
      professional_id: input.professional_id || null,
      valid_until: input.valid_until || null,
      subtotal,
      discount_amount: discount,
      total_amount: total,
      notes: input.notes?.trim() || null,
      terms: input.terms?.trim() || DEFAULT_QUOTE_TERMS,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !quote) return { error: error?.message ?? "Erro ao criar orçamento.", id: null };

  const itemsPayload = input.items.map((item, index) => ({
    quote_id: quote.id,
    item_type: item.item_type,
    reference_id: item.reference_id || null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    section: item.section,
    bill_separately: item.bill_separately ?? false,
    display_order: item.display_order ?? index,
  }));

  const { error: itemsError } = await ctx.supabase.from("quote_items").insert(itemsPayload);
  if (itemsError) return { error: itemsError.message, id: null };

  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
  return { error: null, id: quote.id };
}

export async function updateQuote(
  id: string,
  input: QuoteInput
): Promise<{ error: string | null }> {
  const recipientError = validateRecipient(input);
  if (recipientError) return { error: recipientError };
  if (!input.items.length) return { error: "Adicione ao menos um item." };

  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error };

  const existing = await fetchQuoteById(ctx.supabase, ctx.profile.clinic_id, id);
  if (existing.error || !existing.data) return { error: existing.error ?? "Não encontrado." };
  if (existing.data.status !== "rascunho") {
    return { error: "Somente orçamentos em rascunho podem ser editados." };
  }

  const discount = Number(input.discount_amount ?? 0);
  const { subtotal, total } = computeTotals(input.items, discount);

  const { error } = await ctx.supabase
    .from("quotes")
    .update({
      patient_id: input.patient_id || null,
      pipeline_id: input.pipeline_id || null,
      recipient_name: input.recipient_name?.trim() || null,
      recipient_phone: input.recipient_phone?.trim() || null,
      recipient_email: input.recipient_email?.trim() || null,
      professional_id: input.professional_id || null,
      valid_until: input.valid_until || null,
      subtotal,
      discount_amount: discount,
      total_amount: total,
      notes: input.notes?.trim() || null,
      terms: input.terms?.trim() || DEFAULT_QUOTE_TERMS,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", ctx.profile.clinic_id);

  if (error) return { error: error.message };

  await ctx.supabase.from("quote_items").delete().eq("quote_id", id);

  const itemsPayload = input.items.map((item, index) => ({
    quote_id: id,
    item_type: item.item_type,
    reference_id: item.reference_id || null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    section: item.section,
    bill_separately: item.bill_separately ?? false,
    display_order: item.display_order ?? index,
  }));

  const { error: itemsError } = await ctx.supabase.from("quote_items").insert(itemsPayload);
  if (itemsError) return { error: itemsError.message };

  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
  revalidatePath(`/dashboard/vendas/orcamentos/${id}`);
  return { error: null };
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus
): Promise<{ error: string | null }> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error };

  const existing = await fetchQuoteById(ctx.supabase, ctx.profile.clinic_id, id);
  if (existing.error || !existing.data) return { error: existing.error ?? "Não encontrado." };

  const current = existing.data.status;
  const allowed: Record<QuoteStatus, QuoteStatus[]> = {
    rascunho: ["enviado"],
    enviado: ["aceito", "recusado", "expirado"],
    aceito: [],
    recusado: [],
    expirado: [],
  };

  if (!allowed[current]?.includes(status)) {
    return { error: `Não é possível alterar de "${current}" para "${status}".` };
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "enviado") patch.sent_at = new Date().toISOString();
  if (status === "aceito") patch.accepted_at = new Date().toISOString();

  const { error } = await ctx.supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .eq("clinic_id", ctx.profile.clinic_id);

  if (error) return { error: error.message };

  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
  revalidatePath(`/dashboard/vendas/orcamentos/${id}`);
  return { error: null };
}

export async function deleteQuote(id: string): Promise<{ error: string | null }> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error };

  const existing = await fetchQuoteById(ctx.supabase, ctx.profile.clinic_id, id);
  if (existing.error || !existing.data) return { error: existing.error ?? "Não encontrado." };
  if (existing.data.status !== "rascunho") {
    return { error: "Somente rascunhos podem ser excluídos." };
  }

  const { error } = await ctx.supabase
    .from("quotes")
    .delete()
    .eq("id", id)
    .eq("clinic_id", ctx.profile.clinic_id);

  if (error) return { error: error.message };

  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
  return { error: null };
}

export async function getQuotePdfHtml(id: string): Promise<{
  error: string | null;
  html: string | null;
}> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, html: null };

  const quoteRes = await fetchQuoteById(ctx.supabase, ctx.profile.clinic_id, id);
  if (quoteRes.error || !quoteRes.data) return { error: quoteRes.error, html: null };

  const { data: clinic } = await ctx.supabase
    .from("clinics")
    .select("name, logo_url, logo_scale, address, phone, email")
    .eq("id", ctx.profile.clinic_id)
    .single();

  if (!clinic) return { error: "Clínica não encontrada.", html: null };

  const quote = quoteRes.data;
  const recipient = {
    name: recipientDisplay(quote),
    phone: quote.recipient_phone,
    email: quote.recipient_email,
  };

  const html = renderQuoteHtml({
    clinic: {
      name: clinic.name,
      logo_url: clinic.logo_url ?? null,
      logo_scale: clinic.logo_scale ?? null,
      address: clinic.address ?? null,
      phone: clinic.phone ?? null,
      email: clinic.email ?? null,
    },
    quote,
    recipient,
    professional_name: quote.professional_name,
    emission_date: new Date().toLocaleDateString("pt-BR"),
  });

  return { error: null, html };
}

export async function listQuoteCatalogs(): Promise<{
  error: string | null;
  services: { id: string; nome: string; categoria: string | null }[];
  products: { id: string; name: string; sale_price: number | null; unit: string }[];
  professionals: { id: string; name: string }[];
  leads: { id: string; name: string | null; email: string; phone: string | null }[];
}> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) {
    return { error: ctx.error, services: [], products: [], professionals: [], leads: [] };
  }

  const [servicesRes, productsRes, doctorsRes, leadsRes] = await Promise.all([
    ctx.supabase
      .from("services")
      .select("id, nome, categoria")
      .eq("clinic_id", ctx.profile.clinic_id)
      .order("nome"),
    ctx.supabase
      .from("products")
      .select("id, name, sale_price, unit")
      .eq("clinic_id", ctx.profile.clinic_id)
      .eq("active", true)
      .order("name"),
    ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", ctx.profile.clinic_id)
      .eq("role", "medico")
      .order("full_name"),
    ctx.supabase
      .from("non_registered_pipeline")
      .select("id, name, email, phone")
      .eq("clinic_id", ctx.profile.clinic_id)
      .not("stage", "eq", "agendado")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  return {
    error: null,
    services: servicesRes.data ?? [],
    products: (productsRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sale_price: p.sale_price != null ? Number(p.sale_price) : null,
      unit: p.unit,
    })),
    professionals: (doctorsRes.data ?? []).map((d) => ({
      id: d.id,
      name: d.full_name?.trim() || "Médico",
    })),
    leads: leadsRes.data ?? [],
  };
}

export async function getServiceDefaultPrice(
  serviceId: string,
  professionalId?: string | null
): Promise<{ error: string | null; price: number | null }> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, price: null };

  let query = ctx.supabase
    .from("service_prices")
    .select("valor, professional_id")
    .eq("clinic_id", ctx.profile.clinic_id)
    .eq("service_id", serviceId)
    .eq("ativo", true);

  if (professionalId) {
    query = query.or(`professional_id.is.null,professional_id.eq.${professionalId}`);
  }

  const { data } = await query.order("professional_id", { ascending: false, nullsFirst: false });

  const price = data?.[0]?.valor != null ? Number(data[0].valor) : null;
  return { error: null, price };
}
