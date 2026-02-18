"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  created_at: string;
  updated_at: string;
};

export type ClinicMessageSetting = {
  id: string;
  clinic_id: string;
  event_code: string;
  channel: MessageChannel;
  enabled: boolean;
  send_mode: SendMode;
  template_id: string | null;
  conditions: Record<string, unknown>;
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
  };
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
    .select("email_header, email_footer, email_header_template, email_footer_template, email_branding_colors, logo_url, name, phone, email, address")
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
  emailFooter: string | null = null
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

  const bodyPlain = bodyText?.trim() || bodyHtml.replace(/<[^>]*>/g, "").trim() || "";
  const { data, error } = await supabase
    .from("message_templates")
    .insert({
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
    })
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
    systemRow.email_footer ?? null
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
  emailFooter: string | null = null
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
    .update({
      name: name.trim(),
      subject: subject?.trim() || null,
      body_html: bodyHtml,
      body_text: bodyText?.trim() || null,
      email_header: emailHeader?.trim() ?? null,
      email_footer: emailFooter?.trim() ?? null,
      variables_used: variablesUsed,
    })
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

  const { error } = await supabase
    .from("message_templates")
    .update({ is_active: false })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/mensagens");
  return { error: null };
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

// ========== ATUALIZAR CONFIGURAÇÃO DE EVENTO ==========

export async function updateClinicMessageSetting(
  eventCode: string,
  channel: MessageChannel,
  enabled: boolean,
  sendMode: SendMode,
  templateId: string | null = null
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
    const { data: updated, error } = await supabase
      .from("clinic_message_settings")
      .update({
        enabled,
        send_mode: sendMode,
        template_id: templateId,
      })
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
    const { data: inserted, error } = await supabase
      .from("clinic_message_settings")
      .insert({
        clinic_id: profile.clinic_id,
        event_code: eventCode,
        channel,
        enabled,
        send_mode: sendMode,
        template_id: templateId,
      })
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
    .select("id, channel, type, sent_at, patients(full_name)")
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
  }));
  return { data: entries, error: null };
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

  if (pendingMessage.template_id) {
    const { data: template } = await supabase
      .from("message_templates")
      .select("subject, body_html")
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
    pendingMessage.variables
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
