"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createMetaTemplate,
  fetchTemplateStatus,
  listMetaTemplates,
  type MetaTemplateSummary,
  type WhatsAppTemplateReviewStatus,
} from "@/lib/comunicacao/whatsapp";
import { getAndSyncEffectiveTicketStatus } from "@/lib/whatsapp-ticket-status";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";

// ========== TIPOS ==========

export type MessageChannel = "email" | "whatsapp";
export type SendMode = "automatic" | "manual";

export type MessageEvent = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  default_enabled_email: boolean;
  default_enabled_whatsapp: boolean;
  can_be_automatic: boolean;
  requires_appointment: boolean;
};

export type MessageTemplate = {
  id: string;
  clinic_id: string;
  event_code: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body_html: string;
  body_text: string | null;
  email_header: string | null;
  email_footer: string | null;
  variables_used: string[];
  is_active: boolean;
  is_default: boolean;
  whatsapp_meta_phrase?: string | null;
  whatsapp_meta_template_name?: string | null;
  whatsapp_meta_template_id?: string | null;
  whatsapp_meta_status?: WhatsAppTemplateReviewStatus | null;
  whatsapp_meta_last_error?: string | null;
  whatsapp_meta_submitted_at?: string | null;
  whatsapp_meta_synced_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SystemMetaTemplateKey = "flowmedi_consulta" | "flowmedi_formulario" | "flowmedi_aviso";

export type ClinicMetaTemplateStatus = {
  template_key: SystemMetaTemplateKey;
  template_name: string;
  meta_template_id: string | null;
  status: WhatsAppTemplateReviewStatus;
  last_error: string | null;
  requested_at: string | null;
  synced_at: string | null;
};

export type RemoteMetaTemplateItem = {
  id: string;
  name: string;
  status: WhatsAppTemplateReviewStatus;
  language?: string;
};

const SYSTEM_META_TEMPLATE_DEFS: Array<{
  key: SystemMetaTemplateKey;
  name: string;
  body: string;
}> = [
  {
    key: "flowmedi_consulta",
    name: "flowmedi_consulta_v5",
    body: "Olá {{1}}! Temos uma mensagem importante sobre sua consulta.\n\n{{2}}\n\nSe precisar, responda esta mensagem.",
  },
  {
    key: "flowmedi_formulario",
    name: "flowmedi_formulario_v5",
    body: "Olá {{1}}! Precisamos da sua ajuda com um formulário da clínica.\n\n{{2}}\n\nObrigado pelo apoio.",
  },
  {
    key: "flowmedi_aviso",
    name: "flowmedi_aviso_v5",
    body: "Olá {{1}}! Temos um aviso importante.\n\n{{2}}\n\nEstamos à disposição para dúvidas.",
  },
];

export type ClinicMessageSetting = {
  id: string;
  clinic_id: string;
  event_code: string;
  channel: MessageChannel;
  enabled: boolean;
  send_mode: SendMode;
  template_id: string | null;
  conditions: Record<string, unknown>;
  send_only_when_ticket_open?: boolean;
};

/** Normaliza linha da DB para garantir shape estável e serialização segura (conditions nunca null). */
function normalizeClinicMessageSetting(
  row: Record<string, unknown> | null
): ClinicMessageSetting | null {
  if (!row || typeof row.event_code !== "string" || typeof row.channel !== "string")
    return null;
  return {
    id: String(row.id ?? ""),
    clinic_id: String(row.clinic_id ?? ""),
    event_code: row.event_code,
    channel: row.channel as MessageChannel,
    enabled: Boolean(row.enabled),
    send_mode: (row.send_mode === "automatic" ? "automatic" : "manual") as SendMode,
    template_id: row.template_id != null ? String(row.template_id) : null,
    conditions:
      row.conditions != null && typeof row.conditions === "object" && !Array.isArray(row.conditions)
        ? (row.conditions as Record<string, unknown>)
        : {},
    send_only_when_ticket_open: Boolean(row.send_only_when_ticket_open ?? false),
  };
}

async function getMessagingPlanAccess() {
  const planData = await getClinicPlanData();
  const emailAllowed = Boolean(
    planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
  );
  const whatsappAllowed = Boolean(
    planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
  );
  return { emailAllowed, whatsappAllowed };
}

// ========== BUSCAR EVENTOS DISPONÍVEIS ==========

export async function getMessageEvents(): Promise<{
  data: MessageEvent[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_events")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as MessageEvent[], error: null };
}

// ========== LISTA EFETIVA DE TEMPLATES (SISTEMA + CUSTOM) POR EVENTO/CANAL ==========
// Um item por (evento, canal): Email e WhatsApp separados; mostra padrão do sistema ou template customizado.

export type EffectiveTemplateItem = {
  event_code: string;
  event_name: string;
  channel: MessageChannel;
  is_system: boolean;
  id: string;
  name: string;
  subject: string | null;
  body_preview: string;
};

export async function getEffectiveTemplatesForDisplay(): Promise<{
  data: EffectiveTemplateItem[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const [eventsRes, systemRes, customRes] = await Promise.all([
    supabase.from("message_events").select("code, name").order("category").order("name"),
    supabase.from("system_message_templates").select("id, event_code, channel, name, subject, body_html"),
    supabase.from("message_templates").select("id, event_code, channel, name, subject, body_html").eq("clinic_id", profile.clinic_id).eq("is_active", true),
  ]);

  if (eventsRes.error) return { data: null, error: eventsRes.error.message };
  const events = (eventsRes.data ?? []) as { code: string; name: string }[];
  const systemTemplates = (systemRes.data ?? []) as Array<{ id: string; event_code: string; channel: string; name: string; subject: string | null; body_html: string | null }>;
  const customTemplates = (customRes.data ?? []) as Array<{ id: string; event_code: string; channel: string; name: string; subject: string | null; body_html: string }>;

  const customByKey = new Map<string, (typeof customTemplates)[0]>(
    customTemplates.map((t) => [`${t.event_code}:${t.channel}`, t])
  );
  const systemByKey = new Map<string, (typeof systemTemplates)[0]>(
    systemTemplates.map((t) => [`${t.event_code}:${t.channel}`, t])
  );

  const channels: MessageChannel[] = ["email", "whatsapp"];
  const eventNames = new Map(events.map((e) => [e.code, e.name]));
  const result: EffectiveTemplateItem[] = [];

  for (const event of events) {
    for (const channel of channels) {
      const key = `${event.code}:${channel}`;
      const custom = customByKey.get(key);
      const system = systemByKey.get(key);
      const template = custom ?? system;
      if (!template) continue;

      const body = template.body_html ?? "";
      const bodyPreview = body.replace(/<[^>]*>/g, "").trim().slice(0, 80);
      result.push({
        event_code: event.code,
        event_name: eventNames.get(event.code) ?? event.code,
        channel: channel as MessageChannel,
        is_system: !custom,
        id: template.id,
        name: template.name,
        subject: template.subject ?? null,
        body_preview: bodyPreview ? `${bodyPreview}${body.length > 80 ? "…" : ""}` : "(vazio)",
      });
    }
  }

  return { data: result, error: null };
}

/** Lista apenas os templates do sistema (para exibir na seção "Templates do sistema"). */
export async function getSystemTemplatesForDisplay(): Promise<{
  data: EffectiveTemplateItem[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const [eventsRes, systemRes] = await Promise.all([
    supabase.from("message_events").select("code, name").order("category").order("name"),
    supabase.from("system_message_templates").select("id, event_code, channel, name, subject, body_html"),
  ]);

  if (eventsRes.error) return { data: null, error: eventsRes.error.message };
  if (systemRes.error) return { data: null, error: systemRes.error.message };

  const events = (eventsRes.data ?? []) as { code: string; name: string }[];
  const systemTemplates = (systemRes.data ?? []) as Array<{ id: string; event_code: string; channel: string; name: string; subject: string | null; body_html: string | null }>;
  const eventNames = new Map(events.map((e) => [e.code, e.name]));
  const result: EffectiveTemplateItem[] = systemTemplates.map((t) => {
    const body = t.body_html ?? "";
    const bodyPreview = body.replace(/<[^>]*>/g, "").trim().slice(0, 80);
    return {
      event_code: t.event_code,
      event_name: eventNames.get(t.event_code) ?? t.event_code,
      channel: t.channel as MessageChannel,
      is_system: true,
      id: t.id,
      name: t.name,
      subject: t.subject ?? null,
      body_preview: bodyPreview ? `${bodyPreview}${body.length > 80 ? "…" : ""}` : "(vazio)",
    };
  });

  return { data: result, error: null };
}

// ========== CABEÇALHO E RODAPÉ DOS EMAILS (por clínica, vale para todos) ==========

export async function getClinicEmailBranding(): Promise<{
  data: { 
    email_header: string | null; 
    email_footer: string | null;
    email_header_template: string | null;
    email_footer_template: string | null;
    email_branding_colors: Record<string, unknown> | null;
    logo_url: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    whatsapp_url: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("clinics")
    .select("email_header, email_footer, email_header_template, email_footer_template, email_branding_colors, logo_url, name, phone, email, address, whatsapp_url, facebook_url, instagram_url")
    .eq("id", profile.clinic_id)
    .single();

  if (error) return { data: null, error: error.message };
  return { 
    data: { 
      email_header: data?.email_header ?? null, 
      email_footer: data?.email_footer ?? null,
      email_header_template: data?.email_header_template ?? "minimal",
      email_footer_template: data?.email_footer_template ?? "minimal",
      email_branding_colors: data?.email_branding_colors ?? { primary: "#007bff", secondary: "#6c757d", text: "#333333", background: "#ffffff" },
      logo_url: data?.logo_url ?? null,
      name: data?.name ?? null,
      phone: data?.phone ?? null,
      email: data?.email ?? null,
      address: data?.address ?? null,
      whatsapp_url: data?.whatsapp_url ?? null,
      facebook_url: data?.facebook_url ?? null,
      instagram_url: data?.instagram_url ?? null,
    }, 
    error: null 
  };
}

export async function updateClinicEmailBranding(
  emailHeader: string | null,
  emailFooter: string | null,
  headerTemplate?: string,
  footerTemplate?: string,
  brandingColors?: Record<string, unknown>
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const updateData: Record<string, unknown> = {
    email_header: emailHeader?.trim() || null,
    email_footer: emailFooter?.trim() || null,
  };

  if (headerTemplate) updateData.email_header_template = headerTemplate;
  if (footerTemplate) updateData.email_footer_template = footerTemplate;
  // Mantém cores existentes se não foram passadas
  if (brandingColors) {
    updateData.email_branding_colors = brandingColors;
  }

  const { error } = await supabase
    .from("clinics")
    .update(updateData)
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/mensagens");
  revalidatePath("/dashboard/mensagens/templates");
  return { error: null };
}

// ========== BUSCAR TEMPLATES DA CLÍNICA ==========

export async function getMessageTemplates(
  eventCode?: string,
  channel?: MessageChannel
): Promise<{ data: MessageTemplate[] | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  let query = supabase
    .from("message_templates")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (eventCode) query = query.eq("event_code", eventCode);
  if (channel) query = query.eq("channel", channel);

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as MessageTemplate[], error: null };
}

// ========== BUSCAR TEMPLATE POR ID ==========

export async function getMessageTemplate(
  id: string
): Promise<{ data: MessageTemplate | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as MessageTemplate, error: null };
}

// ========== CRIAR TEMPLATE ==========

export async function createMessageTemplate(
  eventCode: string,
  name: string,
  channel: MessageChannel,
  subject: string | null,
  bodyHtml: string,
  bodyText: string | null,
  variablesUsed: string[] = [],
  emailHeader: string | null = null,
  emailFooter: string | null = null,
  whatsappMetaPhrase: string | null = null
): Promise<{ data: MessageTemplate | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };
  if (profile.role !== "admin") {
    return { data: null, error: "Apenas administradores podem alterar configurações de envio." };
  }

  const access = await getMessagingPlanAccess();
  if (channel === "email" && !access.emailAllowed) {
    return { data: null, error: "Edição de templates de e-mail disponível nos planos com mensageria." };
  }
  if (channel === "whatsapp" && !access.whatsappAllowed) {
    return { data: null, error: "Edição de templates de WhatsApp disponível nos planos com mensageria." };
  }

  const bodyPlain = bodyText?.trim() || bodyHtml.replace(/<[^>]*>/g, "").trim() || "";
  const insertData: Record<string, unknown> = {
    clinic_id: profile.clinic_id,
    event_code: eventCode,
    name: name.trim(),
    channel,
    type: "custom", // legado: coluna pode existir como NOT NULL em DB antiga
    subject: subject?.trim() || null,
    body: bodyPlain || bodyHtml, // legado: coluna body NOT NULL em DB antiga
    body_html: bodyHtml,
    body_text: bodyText?.trim() || null,
    email_header: emailHeader?.trim() || null,
    email_footer: emailFooter?.trim() || null,
    variables_used: variablesUsed,
    is_active: true,
    is_default: false,
  };
  if (channel === "whatsapp" && whatsappMetaPhrase !== undefined) {
    insertData.whatsapp_meta_phrase = whatsappMetaPhrase?.trim() || null;
  }
  const { data, error } = await supabase
    .from("message_templates")
    .insert(insertData)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/dashboard/mensagens");
  return { data: data as MessageTemplate, error: null };
}

/** Copia o template padrão do sistema para a clínica (para editar sem alterar o sistema). */
export async function createMessageTemplateFromSystem(
  eventCode: string,
  channel: MessageChannel
): Promise<{ data: MessageTemplate | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const access = await getMessagingPlanAccess();
  if (channel === "email" && !access.emailAllowed) {
    return { data: null, error: "Edição de templates de e-mail disponível nos planos com mensageria." };
  }
  if (channel === "whatsapp" && !access.whatsappAllowed) {
    return { data: null, error: "Edição de templates de WhatsApp disponível nos planos com mensageria." };
  }

  const { data: systemRow, error: fetchErr } = await supabase
    .from("system_message_templates")
    .select("*")
    .eq("event_code", eventCode)
    .eq("channel", channel)
    .single();

  if (fetchErr || !systemRow) return { data: null, error: "Template padrão do sistema não encontrado." };

  return createMessageTemplate(
    eventCode,
    systemRow.name + " (cópia)",
    channel,
    systemRow.subject ?? null,
    systemRow.body_html ?? "",
    systemRow.body_text ?? null,
    Array.isArray(systemRow.variables_used) ? systemRow.variables_used : [],
    systemRow.email_header ?? null,
    systemRow.email_footer ?? null,
    (systemRow as { whatsapp_meta_phrase?: string | null }).whatsapp_meta_phrase ?? null
  );
}

// ========== ATUALIZAR TEMPLATE ==========

export async function updateMessageTemplate(
  id: string,
  name: string,
  subject: string | null,
  bodyHtml: string,
  bodyText: string | null,
  variablesUsed: string[] = [],
  emailHeader: string | null = null,
  emailFooter: string | null = null,
  whatsappMetaPhrase?: string | null
): Promise<{ data: MessageTemplate | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data: templateRow } = await supabase
    .from("message_templates")
    .select("channel")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();
  if (!templateRow?.channel) return { data: null, error: "Template não encontrado." };

  const access = await getMessagingPlanAccess();
  if (templateRow.channel === "email" && !access.emailAllowed) {
    return { data: null, error: "Edição de templates de e-mail disponível nos planos com mensageria." };
  }
  if (templateRow.channel === "whatsapp" && !access.whatsappAllowed) {
    return { data: null, error: "Edição de templates de WhatsApp disponível nos planos com mensageria." };
  }

  const updateData: Record<string, unknown> = {
    name: name.trim(),
    subject: subject?.trim() || null,
    body_html: bodyHtml,
    body_text: bodyText?.trim() || null,
    email_header: emailHeader?.trim() ?? null,
    email_footer: emailFooter?.trim() ?? null,
    variables_used: variablesUsed,
  };
  if (whatsappMetaPhrase !== undefined) {
    updateData.whatsapp_meta_phrase = whatsappMetaPhrase?.trim() || null;
  }
  const { data, error } = await supabase
    .from("message_templates")
    .update(updateData)
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/dashboard/mensagens");
  return { data: data as MessageTemplate, error: null };
}

// ========== DESATIVAR TEMPLATE ==========

export async function deactivateMessageTemplate(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { data: templateRow } = await supabase
    .from("message_templates")
    .select("channel")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();
  if (!templateRow?.channel) return { error: "Template não encontrado." };

  const access = await getMessagingPlanAccess();
  if (templateRow.channel === "email" && !access.emailAllowed) {
    return { error: "Edição de templates de e-mail disponível nos planos com mensageria." };
  }
  if (templateRow.channel === "whatsapp" && !access.whatsappAllowed) {
    return { error: "Edição de templates de WhatsApp disponível nos planos com mensageria." };
  }

  const { error } = await supabase
    .from("message_templates")
    .update({ is_active: false })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/mensagens");
  return { error: null };
}

async function getClinicAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, clinicId: null as string | null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id || profile.role !== "admin") {
    return { supabase, clinicId: null as string | null, error: "Apenas administradores podem gerenciar templates Meta." };
  }
  return { supabase, clinicId: profile.clinic_id as string, error: null };
}

function normalizeClinicMetaRows(rows: Array<Record<string, unknown>>): ClinicMetaTemplateStatus[] {
  const byKey = new Map<SystemMetaTemplateKey, ClinicMetaTemplateStatus>();
  for (const row of rows) {
    const key = String(row.template_key || "") as SystemMetaTemplateKey;
    if (!SYSTEM_META_TEMPLATE_DEFS.some((d) => d.key === key)) continue;
    byKey.set(key, {
      template_key: key,
      template_name: String(row.template_name || key),
      meta_template_id: row.meta_template_id ? String(row.meta_template_id) : null,
      status: (row.status as WhatsAppTemplateReviewStatus) || "PENDING",
      last_error: row.last_error ? String(row.last_error) : null,
      requested_at: row.requested_at ? String(row.requested_at) : null,
      synced_at: row.synced_at ? String(row.synced_at) : null,
    });
  }

  return SYSTEM_META_TEMPLATE_DEFS.map((def) => (
    byKey.get(def.key) ?? {
      template_key: def.key,
      template_name: def.name,
      meta_template_id: null,
      status: "PENDING",
      last_error: null,
      requested_at: null,
      synced_at: null,
    }
  ));
}

export async function getClinicSystemMetaTemplatesStatus(): Promise<{
  data: ClinicMetaTemplateStatus[] | null;
  error: string | null;
}> {
  const ctx = await getClinicAdminContext();
  if (ctx.error || !ctx.clinicId) return { data: null, error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("clinic_whatsapp_meta_templates")
    .select("template_key, template_name, meta_template_id, status, last_error, requested_at, synced_at")
    .eq("clinic_id", ctx.clinicId)
    .order("template_key", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: normalizeClinicMetaRows((data ?? []) as Array<Record<string, unknown>>), error: null };
}

export async function getRemoteMetaTemplates(): Promise<{
  data: RemoteMetaTemplateItem[] | null;
  error: string | null;
}> {
  const ctx = await getClinicAdminContext();
  if (ctx.error || !ctx.clinicId) return { data: null, error: ctx.error };

  const listed = await listMetaTemplates(ctx.clinicId, ctx.supabase);
  if (!listed.success) {
    return { data: null, error: listed.error || "Falha ao listar templates da Meta." };
  }

  const data: RemoteMetaTemplateItem[] = (listed.templates ?? []).map((tpl: MetaTemplateSummary) => ({
    id: tpl.id,
    name: tpl.name,
    status: tpl.status,
    language: tpl.language,
  }));
  return { data, error: null };
}

export async function requestSystemMetaTemplates(): Promise<{
  error: string | null;
  debug?: Record<string, unknown>;
}> {
  const ctx = await getClinicAdminContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error };
  const { supabase, clinicId } = ctx;

  const access = await getMessagingPlanAccess();
  if (!access.whatsappAllowed) {
    return { error: "Este recurso está disponível nos planos com WhatsApp." };
  }

  const nowIso = new Date().toISOString();
  const { data: integrationRow } = await supabase
    .from("clinic_integrations")
    .select("status, metadata")
    .eq("clinic_id", clinicId)
    .eq("integration_type", "whatsapp_meta")
    .maybeSingle();
  const integrationMeta = (integrationRow?.metadata as Record<string, unknown> | null) || null;

  const listed = await listMetaTemplates(clinicId, supabase);
  const remoteByName = new Map<string, { id: string; status: WhatsAppTemplateReviewStatus }>();
  if (listed.success && listed.templates) {
    for (const tpl of listed.templates) {
      remoteByName.set(tpl.name, { id: tpl.id, status: tpl.status });
    }
  }

  await Promise.all(
    SYSTEM_META_TEMPLATE_DEFS.map(async (def) => {
      const existingRemote = remoteByName.get(def.name);
      let metaTemplateId = existingRemote?.id ?? null;
      let status: WhatsAppTemplateReviewStatus = existingRemote?.status ?? "PENDING";
      let lastError: string | null = null;

      if (!existingRemote) {
        const created = await createMetaTemplate(
          clinicId,
          {
            name: def.name,
            bodyText: def.body,
          },
          supabase
        );
        if (created.success) {
          metaTemplateId = created.templateId ?? null;
          status = created.status ?? "PENDING";
        } else {
          lastError = created.error || "Falha ao criar template na Meta.";
        }
      }

      await supabase
        .from("clinic_whatsapp_meta_templates")
        .upsert({
          clinic_id: clinicId,
          template_key: def.key,
          template_name: def.name,
          meta_template_id: metaTemplateId,
          status,
          last_error: lastError,
          requested_at: nowIso,
          synced_at: nowIso,
        }, { onConflict: "clinic_id,template_key" });
    })
  );

  const debug = {
    clinicId,
    integrationStatus: integrationRow?.status ?? null,
    selectedWabaId: integrationMeta?.waba_id ?? null,
    selectedPhoneNumberId: integrationMeta?.phone_number_id ?? null,
    listedSuccess: listed.success,
    listedCount: listed.templates?.length ?? 0,
    listedTemplateNames: (listed.templates ?? []).map((tpl) => tpl.name),
  };
  console.info("[WA_DEBUG][Actions] requestSystemMetaTemplates", debug);

  revalidatePath("/dashboard/mensagens/templates");
  return { error: null, debug };
}

export async function refreshSystemMetaTemplatesStatus(): Promise<{
  error: string | null;
  debug?: Record<string, unknown>;
}> {
  const ctx = await getClinicAdminContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error };
  const { supabase, clinicId } = ctx;

  const access = await getMessagingPlanAccess();
  if (!access.whatsappAllowed) {
    return { error: "Este recurso está disponível nos planos com WhatsApp." };
  }

  const { data: rows, error } = await supabase
    .from("clinic_whatsapp_meta_templates")
    .select("template_key, meta_template_id, status")
    .eq("clinic_id", clinicId);
  if (error) return { error: error.message };

  const nowIso = new Date().toISOString();
  for (const row of rows ?? []) {
    const templateId = row.meta_template_id as string | null;
    if (!templateId) continue;

    const remote = await fetchTemplateStatus(clinicId, templateId, supabase);
    await supabase
      .from("clinic_whatsapp_meta_templates")
      .update({
        status: remote.success && remote.status ? remote.status : (row.status as string) || "PENDING",
        last_error: remote.success ? null : (remote.error || "Falha ao sincronizar status."),
        synced_at: nowIso,
      })
      .eq("clinic_id", clinicId)
      .eq("template_key", row.template_key);
  }

  const { data: integrationRow } = await supabase
    .from("clinic_integrations")
    .select("status, metadata")
    .eq("clinic_id", clinicId)
    .eq("integration_type", "whatsapp_meta")
    .maybeSingle();
  const integrationMeta = (integrationRow?.metadata as Record<string, unknown> | null) || null;
  const debug = {
    clinicId,
    integrationStatus: integrationRow?.status ?? null,
    selectedWabaId: integrationMeta?.waba_id ?? null,
    selectedPhoneNumberId: integrationMeta?.phone_number_id ?? null,
    localRowsCount: rows?.length ?? 0,
  };
  console.info("[WA_DEBUG][Actions] refreshSystemMetaTemplatesStatus", debug);

  revalidatePath("/dashboard/mensagens/templates");
  return { error: null, debug };
}

// ========== BUSCAR CONFIGURAÇÕES DA CLÍNICA ==========

export async function getClinicMessageSettings(): Promise<{
  data: ClinicMessageSetting[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("clinic_message_settings")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .order("event_code", { ascending: true })
    .order("channel", { ascending: true });

  if (error) return { data: null, error: error.message };
  const normalized = (data ?? [])
    .map((row) => normalizeClinicMessageSetting(row as Record<string, unknown>))
    .filter((s): s is ClinicMessageSetting => s != null);
  return { data: normalized, error: null };
}

// ========== ATUALIZAR CONFIGURAÇàO DE EVENTO ==========

export async function updateClinicMessageSetting(
  eventCode: string,
  channel: MessageChannel,
  enabled: boolean,
  sendMode: SendMode,
  templateId: string | null = null,
  sendOnlyWhenTicketOpen: boolean = false
): Promise<{ data: ClinicMessageSetting | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const access = await getMessagingPlanAccess();
  if (channel === "email" && !access.emailAllowed) {
    return { data: null, error: "Configuração de e-mail disponível nos planos com mensageria." };
  }
  if (channel === "whatsapp" && !access.whatsappAllowed) {
    return { data: null, error: "Configuração de WhatsApp disponível nos planos com mensageria." };
  }

  // Verificar se já existe configuração
  const { data: existing } = await supabase
    .from("clinic_message_settings")
    .select("id")
    .eq("clinic_id", profile.clinic_id)
    .eq("event_code", eventCode)
    .eq("channel", channel)
    .single();

  if (existing) {
    // Atualizar existente
    const updateData: Record<string, unknown> = {
      enabled,
      send_mode: sendMode,
      template_id: templateId,
    };
    // Só atualizar send_only_when_ticket_open se for WhatsApp
    if (channel === "whatsapp") {
      updateData.send_only_when_ticket_open = sendOnlyWhenTicketOpen;
    }
    const { data: updated, error } = await supabase
      .from("clinic_message_settings")
      .update(updateData)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    // Não usar revalidatePath aqui: o cliente atualiza estado local e um refresh refetcharia a página inteira (tela branca/scroll).
    return {
      data: normalizeClinicMessageSetting(updated as Record<string, unknown>),
      error: null,
    };
  } else {
    // Criar nova configuração
    const insertData: Record<string, unknown> = {
      clinic_id: profile.clinic_id,
      event_code: eventCode,
      channel,
      enabled,
      send_mode: sendMode,
      template_id: templateId,
    };
    // Só incluir send_only_when_ticket_open se for WhatsApp
    if (channel === "whatsapp") {
      insertData.send_only_when_ticket_open = sendOnlyWhenTicketOpen;
    }
    const { data: inserted, error } = await supabase
      .from("clinic_message_settings")
      .insert(insertData)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return {
      data: normalizeClinicMessageSetting(inserted as Record<string, unknown>),
      error: null,
    };
  }
}

// ========== HISTÓRICO DE MENSAGENS ENVIADAS ==========

export type MessageLogEntry = {
  id: string;
  channel: MessageChannel;
  type: string;
  sent_at: string;
  patient_name: string | null;
  metadata: Record<string, unknown> | null;
};

export async function getRecentMessageLog(limit = 15): Promise<{
  data: MessageLogEntry[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("message_log")
    .select("id, channel, type, sent_at, metadata, patients(full_name)")
    .eq("clinic_id", profile.clinic_id)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: error.message };

  const entries: MessageLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    channel: row.channel,
    type: row.type,
    sent_at: row.sent_at,
    patient_name: row.patients?.full_name ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  }));
  return { data: entries, error: null };
}

export async function getMessageLogById(
  id: string
): Promise<{ data: MessageLogEntry | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("message_log")
    .select("id, channel, type, sent_at, metadata, patients(full_name)")
    .eq("clinic_id", profile.clinic_id)
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "Mensagem não encontrada." };

  return {
    data: {
      id: data.id,
      channel: data.channel as MessageChannel,
      type: String(data.type ?? ""),
      sent_at: String(data.sent_at ?? ""),
      patient_name: (data as any).patients?.full_name ?? null,
      metadata:
        data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
          ? (data.metadata as Record<string, unknown>)
          : null,
    },
    error: null,
  };
}

// ========== BUSCAR MENSAGENS PENDENTES ==========

export async function getPendingMessages(): Promise<{
  data: Array<{
    id: string;
    patient: { full_name: string };
    appointment: { scheduled_at: string; appointment_type: { name: string } | null } | null;
    event_code: string;
    channel: MessageChannel;
    status: string;
    created_at: string;
    processed_body?: string;
  }> | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("pending_messages")
    .select(`
      id,
      patient:patients(full_name),
      appointment:appointments(
        scheduled_at,
        appointment_type:appointment_types(name)
      ),
      event_code,
      channel,
      status,
      created_at,
      processed_body
    `)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as any, error: null };
}

// ========== APROVAR MENSAGEM PENDENTE ==========

export async function approvePendingMessage(
  messageId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  // Buscar mensagem pendente
  const { data: pendingMessage, error: fetchError } = await supabase
    .from("pending_messages")
    .select("*")
    .eq("id", messageId)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending")
    .single();

  if (fetchError || !pendingMessage) {
    return { error: "Mensagem não encontrada ou já processada" };
  }

  // Assunto e corpo: quando template_id é null (template do sistema), usar processed_subject e processed_body
  let finalBody = pendingMessage.processed_body || "";
  let finalSubject = (pendingMessage as { processed_subject?: string | null }).processed_subject ?? null;
  let whatsappMetaPhrase: string | null = null;

  if (pendingMessage.template_id) {
    const { data: template } = await supabase
      .from("message_templates")
      .select("subject, body_html, whatsapp_meta_phrase")
      .eq("id", pendingMessage.template_id)
      .single();

    if (template) {
      if (!finalSubject) finalSubject = template.subject ?? null;
      if (!finalBody && template.body_html) {
        const { replaceVariables } = await import("@/lib/message-variables");
        finalBody = replaceVariables(template.body_html, pendingMessage.variables as any);
      }
      if (finalSubject && pendingMessage.variables) {
        const { replaceVariables } = await import("@/lib/message-variables");
        finalSubject = replaceVariables(finalSubject, pendingMessage.variables as any);
      }
      whatsappMetaPhrase = template.whatsapp_meta_phrase ?? null;
    }
  } else if (pendingMessage.channel === "whatsapp") {
    // Template do sistema: buscar whatsapp_meta_phrase
    const { data: sysTemplate } = await supabase
      .from("system_message_templates")
      .select("whatsapp_meta_phrase")
      .eq("event_code", pendingMessage.event_code)
      .eq("channel", "whatsapp")
      .single();
    whatsappMetaPhrase = sysTemplate?.whatsapp_meta_phrase ?? null;
  }

  // Para WhatsApp: buscar status do ticket e configuração send_only_when_ticket_open
  let whatsappTicketStatus: "open" | "closed" | "completed" | null = null;
  let sendOnlyWhenTicketOpen = false;
  
  if (pendingMessage.channel === "whatsapp") {
    // Buscar configuração do evento
    const { data: setting } = await supabase
      .from("clinic_message_settings")
      .select("send_only_when_ticket_open")
      .eq("clinic_id", pendingMessage.clinic_id)
      .eq("event_code", pendingMessage.event_code)
      .eq("channel", "whatsapp")
      .single();
    
    sendOnlyWhenTicketOpen = Boolean(setting?.send_only_when_ticket_open);
    
    // Buscar status do ticket
    const { data: patient } = await supabase
      .from("patients")
      .select("phone")
      .eq("id", pendingMessage.patient_id)
      .single();
    
    if (patient?.phone) {
      const { normalizeWhatsAppPhone } = await import("@/lib/whatsapp-utils");
      // Normalizar telefone do paciente da mesma forma que no chat
      const patientPhoneDigits = patient.phone.replace(/\D/g, "");
      const normalizedPhone = normalizeWhatsAppPhone(patientPhoneDigits);
      
      // Buscar conversa com número normalizado
      const { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("id, status, last_inbound_message_at")
        .eq("clinic_id", pendingMessage.clinic_id)
        .eq("phone_number", normalizedPhone)
        .maybeSingle();
      
      whatsappTicketStatus = (await getAndSyncEffectiveTicketStatus(
        pendingMessage.clinic_id,
        conversation
          ? {
              id: conversation.id,
              status: conversation.status ?? null,
              last_inbound_message_at: conversation.last_inbound_message_at ?? null,
            }
          : null,
        supabase
      )) as "open" | "closed" | "completed" | null;
      
      // Se ticket fechado/completed e checkbox marcada, não enviar
      if (sendOnlyWhenTicketOpen && whatsappTicketStatus !== "open") {
        return { error: "Ticket não está aberto. Mensagem não será enviada." };
      }
    }
  }

  // Enviar mensagem
  const { sendMessage } = await import("@/lib/message-processor");
  const sendResult = await sendMessage(
    pendingMessage.channel as MessageChannel,
    pendingMessage.clinic_id,
    pendingMessage.patient_id,
    pendingMessage.appointment_id,
    pendingMessage.event_code,
    pendingMessage.template_id,
    finalSubject,
    finalBody,
    pendingMessage.variables,
    undefined, // supabaseClient
    whatsappTicketStatus,
    sendOnlyWhenTicketOpen,
    pendingMessage.channel === "whatsapp" ? whatsappMetaPhrase : undefined
  );

  if (!sendResult.success) {
    // Atualizar status para failed
    await supabase
      .from("pending_messages")
      .update({
        status: "failed",
        error_message: sendResult.error,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    return { error: sendResult.error || "Erro ao enviar mensagem" };
  }

  // Atualizar status para sent
  const { error } = await supabase
    .from("pending_messages")
    .update({
      status: "sent",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/mensagens/pendentes");
  return { error: null };
}

// ========== REJEITAR MENSAGEM PENDENTE ==========

export async function rejectPendingMessage(
  messageId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { error } = await supabase
    .from("pending_messages")
    .update({
      status: "rejected",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/mensagens");
  return { error: null };
}
