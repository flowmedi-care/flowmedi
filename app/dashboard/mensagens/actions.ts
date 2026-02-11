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
  variablesUsed: string[] = []
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
    .insert({
      clinic_id: profile.clinic_id,
      event_code: eventCode,
      name: name.trim(),
      channel,
      subject: subject?.trim() || null,
      body_html: bodyHtml,
      body_text: bodyText?.trim() || null,
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

// ========== ATUALIZAR TEMPLATE ==========

export async function updateMessageTemplate(
  id: string,
  name: string,
  subject: string | null,
  bodyHtml: string,
  bodyText: string | null,
  variablesUsed: string[] = []
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
  return { data: data as ClinicMessageSetting[], error: null };
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
    revalidatePath("/dashboard/mensagens");
    return { data: updated as ClinicMessageSetting, error: null };
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
    revalidatePath("/dashboard/mensagens");
    return { data: inserted as ClinicMessageSetting, error: null };
  }
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

  // Buscar template para pegar subject se necessário
  const { data: template } = await supabase
    .from("message_templates")
    .select("subject, body_html")
    .eq("id", pendingMessage.template_id)
    .single();

  // Se não tem processed_body, processar novamente
  let finalBody = pendingMessage.processed_body || "";
  let finalSubject = template?.subject || null;

  // Processar template com variáveis já salvas
  if (template && pendingMessage.variables) {
    const { replaceVariables } = await import("@/lib/message-variables");
    const context = pendingMessage.variables as any;
    
    if (!finalBody && template.body_html) {
      finalBody = replaceVariables(template.body_html, context);
    }
    
    if (finalSubject) {
      finalSubject = replaceVariables(finalSubject, context);
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
