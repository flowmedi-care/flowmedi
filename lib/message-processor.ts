/**
 * Sistema de processamento de eventos de mensagens
 */

import { createClient } from "@/lib/supabase/server";
import { buildVariableContext, replaceVariables } from "./message-variables";
import type { MessageChannel } from "@/app/dashboard/mensagens/actions";

export type ProcessMessageResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export type SupabaseClientType = Awaited<ReturnType<typeof createClient>>;

/**
 * Processa um evento e cria mensagem (automática ou pendente)
 * @param supabaseAdmin - Cliente com service role (obrigatório quando chamado sem usuário, ex: cron)
 */
export async function processMessageEvent(
  eventCode: string,
  clinicId: string,
  patientId: string,
  appointmentId: string | null,
  channel: MessageChannel,
  supabaseAdmin?: SupabaseClientType
): Promise<ProcessMessageResult> {
  const supabase = supabaseAdmin ?? (await createClient());

  try {
    // 1. Buscar configuração do evento para este canal
    const { data: setting, error: settingError } = await supabase
      .from("clinic_message_settings")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("event_code", eventCode)
      .eq("channel", channel)
      .eq("enabled", true)
      .single();

    if (settingError || !setting) {
      return {
        success: false,
        error: "Evento não está ativado ou não encontrado",
      };
    }

    // 1.1. Verificar integração se for email
    if (channel === "email") {
      const { checkEmailIntegration } = await import("@/lib/comunicacao/email");
      const integrationCheck = await checkEmailIntegration(clinicId, supabase);
      
      if (!integrationCheck.connected) {
        return {
          success: false,
          error: "Integração Google não conectada. Conecte em Configurações → Integrações",
        };
      }
    }

    // 2. Consentimento LGPD: não bloqueamos envio de mensagens transacionais (lembretes, confirmações, etc.).
    // A base legal é execução de contrato/legítimo interesse — paciente já se relaciona com a clínica ao agendar.
    // A tabela consents permanece disponível para clínicas que quiserem registrar consentimento explícito.

    // 3. Buscar template: primeiro customizado (message_templates), senão padrão do sistema (system_message_templates)
    let template: { id?: string; subject?: string | null; body_html: string; email_header?: string | null; email_footer?: string | null; channel: string } | null = null;

    if (setting.template_id) {
      const { data: customTemplate } = await supabase
        .from("message_templates")
        .select("id, subject, body_html, email_header, email_footer")
        .eq("id", setting.template_id)
        .eq("is_active", true)
        .single();

      if (customTemplate) {
        template = { ...customTemplate, channel };
      }
    }

    if (!template) {
      const { data: systemTemplate } = await supabase
        .from("system_message_templates")
        .select("subject, body_html, email_header, email_footer")
        .eq("event_code", eventCode)
        .eq("channel", channel)
        .single();

      if (systemTemplate) {
        template = { ...systemTemplate, body_html: systemTemplate.body_html ?? "", channel };
      }
    }

    if (!template) {
      return {
        success: false,
        error: "Template não encontrado. Crie um template para este evento ou use o padrão do sistema.",
      };
    }

    // 4. Buscar dados para variáveis
    const context = await buildVariableContextFromIds(
      patientId,
      appointmentId,
      clinicId,
      supabase
    );

    // 5. Processar template (substituir variáveis) e montar corpo email
    const processedSubject = template.subject
      ? replaceVariables(template.subject, context)
      : null;
    const rawBody = replaceVariables(template.body_html || "", context);
    let processedBody = rawBody;
    if (channel === "email") {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("email_header, email_footer")
        .eq("id", clinicId)
        .single();
      const header = (clinic?.email_header && replaceVariables(clinic.email_header, context)) || "";
      const footer = (clinic?.email_footer && replaceVariables(clinic.email_footer, context)) || "";
      processedBody = header + rawBody + footer;
    }

    // 6. Se modo automático, enviar diretamente
    if (setting.send_mode === "automatic") {
      return await sendMessage(
        channel,
        clinicId,
        patientId,
        appointmentId,
        eventCode,
        template.id ?? null,
        processedSubject,
        processedBody,
        context,
        supabase
      );
    }

    // 7. Se modo manual, criar mensagem pendente (template_id null quando usa template do sistema)
    const { data: pendingMessage, error: pendingError } = await supabase
      .from("pending_messages")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        appointment_id: appointmentId,
        event_code: eventCode,
        channel,
        template_id: template.id ?? null,
        processed_subject: processedSubject,
        variables: context as any,
        processed_body: processedBody,
        status: "pending",
        suggested_by: null,
      })
      .select("id")
      .single();

    if (pendingError || !pendingMessage) {
      return {
        success: false,
        error: pendingError?.message || "Erro ao criar mensagem pendente",
      };
    }

    return {
      success: true,
      messageId: pendingMessage.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Busca dados do contexto a partir dos IDs
 */
async function buildVariableContextFromIds(
  patientId: string,
  appointmentId: string | null,
  clinicId: string,
  supabaseClient?: SupabaseClientType
) {
  const supabase = supabaseClient ?? (await createClient());

  // Buscar paciente
  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, email, phone, birth_date")
    .eq("id", patientId)
    .single();

  // Buscar clínica
  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .single();

  let appointment = null;
  let doctor = null;
  let appointmentType = null;
  let procedure = null;
  let formInstance = null;

  if (appointmentId) {
    // Buscar consulta com relacionamentos
    const { data: appointmentData } = await supabase
      .from("appointments")
      .select(`
        scheduled_at,
        status,
        recommendations,
        requires_fasting,
        special_instructions,
        preparation_notes,
        doctor:profiles!appointments_doctor_id_fkey(full_name),
        appointment_type:appointment_types(name),
        procedure:procedures(name)
      `)
      .eq("id", appointmentId)
      .single();

    if (appointmentData) {
      appointment = {
        scheduled_at: appointmentData.scheduled_at,
        status: appointmentData.status,
        recommendations: appointmentData.recommendations,
        requires_fasting: appointmentData.requires_fasting,
        special_instructions: appointmentData.special_instructions,
        preparation_notes: appointmentData.preparation_notes,
      };

      doctor = Array.isArray(appointmentData.doctor)
        ? appointmentData.doctor[0]
        : appointmentData.doctor;

      appointmentType = Array.isArray(appointmentData.appointment_type)
        ? appointmentData.appointment_type[0]
        : appointmentData.appointment_type;
    }

    if (appointmentData?.procedure) {
      procedure = Array.isArray(appointmentData.procedure)
        ? appointmentData.procedure[0]
        : appointmentData.procedure;
    }

    // Buscar formulário pendente (status != 'respondido') para incluir link no template
    // Se todos respondidos, não inclui link (template "só consulta agendada")
    const { data: formData } = await supabase
      .from("form_instances")
      .select(`
        link_token,
        status,
        form_template:form_templates(name)
      `)
      .eq("appointment_id", appointmentId)
      .neq("status", "respondido")
      .limit(1)
      .maybeSingle();

    if (formData) {
      formInstance = {
        link_token: formData.link_token,
        form_template: Array.isArray(formData.form_template)
          ? formData.form_template[0]
          : formData.form_template,
      };
    }
  }

  return buildVariableContext({
    patient: patient || undefined,
    appointment: appointment || undefined,
    doctor: doctor || undefined,
    appointmentType: appointmentType || undefined,
    procedure: procedure || undefined,
    clinic: clinic || undefined,
    formInstance: formInstance || undefined,
  });
}

/**
 * Envia mensagem (email ou WhatsApp) - função exportada para uso externo
 */
export async function sendMessage(
  channel: MessageChannel,
  clinicId: string,
  patientId: string,
  appointmentId: string | null,
  eventCode: string,
  templateId: string | null,
  subject: string | null,
  body: string,
  variables: any,
  supabaseClient?: SupabaseClientType
): Promise<ProcessMessageResult> {
  const supabase = supabaseClient ?? (await createClient());

  try {
    // Buscar email/telefone do paciente
    const { data: patient } = await supabase
      .from("patients")
      .select("email, phone")
      .eq("id", patientId)
      .single();

    if (!patient) {
      return { success: false, error: "Paciente não encontrado" };
    }

    let sendResult: ProcessMessageResult;

    if (channel === "email") {
      if (!patient.email) {
        return { success: false, error: "Paciente não possui email cadastrado" };
      }

      if (!subject) {
        return { success: false, error: "Assunto do email é obrigatório" };
      }

      // Verificar se integração Google está conectada
      const { checkEmailIntegration } = await import("@/lib/comunicacao/email");
      const integrationCheck = await checkEmailIntegration(clinicId, supabase);
      
      if (!integrationCheck.connected) {
        return {
          success: false,
          error: integrationCheck.error || "Integração Google não conectada. Conecte em Configurações → Integrações",
        };
      }

      sendResult = await sendEmail(clinicId, patient.email, subject, body, supabase);
    } else {
      // WhatsApp
      if (!patient.phone) {
        return {
          success: false,
          error: "Paciente não possui telefone cadastrado",
        };
      }

      sendResult = await sendWhatsApp(clinicId, patient.phone, body);
    }

    if (!sendResult.success) {
      return sendResult;
    }

    // Registrar no log
    await supabase.from("message_log").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      appointment_id: appointmentId,
      channel,
      type: eventCode,
      metadata: {
        template_id: templateId,
        subject,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao enviar mensagem",
    };
  }
}

/**
 * Envia email usando Gmail API (via OAuth Google).
 * @param supabaseAdmin - Quando envio sem usuário (ex: formulário público), passar cliente service role.
 */
async function sendEmail(
  clinicId: string,
  to: string,
  subject: string,
  htmlBody: string,
  supabaseAdmin?: Awaited<ReturnType<typeof createClient>>
): Promise<ProcessMessageResult> {
  try {
    const { sendEmail: sendEmailViaGmail } = await import("@/lib/comunicacao/email");

    const result = await sendEmailViaGmail(
      clinicId,
      {
        to,
        subject,
        html: htmlBody,
        body: htmlBody.replace(/<[^>]*>/g, ""),
      },
      supabaseAdmin
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Erro ao enviar email",
      };
    }

    return { 
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao enviar email",
    };
  }
}

/**
 * Envia WhatsApp via Meta Cloud API
 */
async function sendWhatsApp(
  clinicId: string,
  phone: string,
  message: string
): Promise<ProcessMessageResult> {
  try {
    const { checkWhatsAppIntegration, sendWhatsAppMessage } = await import("@/lib/comunicacao/whatsapp");

    // Verificar se a integração WhatsApp está conectada
    const integrationCheck = await checkWhatsAppIntegration(clinicId);
    if (!integrationCheck.connected) {
      return {
        success: false,
        error:
          integrationCheck.error ||
          "Integração WhatsApp não conectada. Conecte em Configurações → Integrações",
      };
    }

    // Normalizar telefone para apenas dígitos (esperado no formato 55DDDNÚMERO)
    const digitsOnly = phone.replace(/\D/g, "");
    if (!digitsOnly) {
      return {
        success: false,
        error: "Telefone do paciente inválido",
      };
    }

    const result = await sendWhatsAppMessage(clinicId, {
      to: digitsOnly,
      text: message,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Erro ao enviar mensagem WhatsApp",
      };
    }

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao enviar mensagem WhatsApp",
    };
  }
}

/**
 * Processa envio automático para evento de formulário público (sem paciente).
 * O destinatário é o email que a pessoa preencheu no formulário (public_submitter_email);
 * não precisa estar cadastrada como paciente. O envio usa o template da clínica e a conta
 * Gmail vinculada à clínica (a mesma do formulário).
 * @param eventId - ID do evento na event_timeline
 * @param supabaseAdmin - Cliente com service role (obrigatório quando chamado da API pública sem usuário)
 */
export async function processEventByIdForPublicForm(
  eventId: string,
  supabaseAdmin?: Awaited<ReturnType<typeof createClient>>
): Promise<ProcessMessageResult> {
  try {
    const supabase = supabaseAdmin ?? (await createClient());

    const { data: event, error: eventError } = await supabase
      .from("event_timeline")
      .select("id, clinic_id, event_code, status, channels, template_ids, metadata")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return { success: false, error: `Evento não encontrado. ${eventError?.message ?? ""}`.trim() };
    }

  if (event.status !== "pending") {
    return { success: false, error: "Evento já foi processado." };
  }

  const metadata = (event.metadata as Record<string, unknown>) || {};
  const toEmail = metadata.public_submitter_email as string | undefined;
  if (!toEmail || typeof toEmail !== "string") {
    return { success: false, error: "Email do formulário não encontrado no evento." };
  }

  // Envio pode ser automático (formulário enviado) ou manual (botão Enviar no dashboard); em ambos os casos enviar quando chamado
  const { data: setting } = await supabase
    .from("clinic_message_settings")
    .select("template_id, send_mode")
    .eq("clinic_id", event.clinic_id)
    .eq("event_code", event.event_code)
    .eq("channel", "email")
    .eq("enabled", true)
    .maybeSingle();

  const { checkEmailIntegration } = await import("@/lib/comunicacao/email");
  const integrationCheck = await checkEmailIntegration(event.clinic_id, supabase);
  if (!integrationCheck.connected) {
    return {
      success: false,
      error: "Integração Google não conectada.",
    };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", event.clinic_id)
    .single();

  const context = await buildVariableContext({
    patient: {
      full_name: (metadata.public_submitter_name as string) || undefined,
      email: toEmail,
      phone: (metadata.public_submitter_phone as string) || undefined,
      birth_date: (metadata.public_submitter_birth_date as string) || undefined,
    },
    clinic: clinic || undefined,
  });

  let template: { subject?: string | null; body_html: string; email_header?: string | null; email_footer?: string | null } | null = null;

  if (setting?.template_id) {
    const { data: customTemplate } = await supabase
      .from("message_templates")
      .select("subject, body_html, email_header, email_footer")
      .eq("id", setting.template_id)
      .eq("is_active", true)
      .single();
    template = customTemplate;
  }

  if (!template) {
    const { data: systemTemplate } = await supabase
      .from("system_message_templates")
      .select("subject, body_html, email_header, email_footer")
      .eq("event_code", event.event_code)
      .eq("channel", "email")
      .single();
    if (systemTemplate) {
      template = { ...systemTemplate, body_html: systemTemplate.body_html ?? "" };
    }
  }

  if (!template) {
    return { success: false, error: "Template de email não encontrado." };
  }

  const processedSubject = template.subject ? replaceVariables(template.subject, context) : null;
  const rawBody = replaceVariables(template.body_html || "", context);
  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("email_header, email_footer")
    .eq("id", event.clinic_id)
    .single();
  const header = (clinicRow?.email_header && replaceVariables(clinicRow.email_header, context)) || "";
  const footer = (clinicRow?.email_footer && replaceVariables(clinicRow.email_footer, context)) || "";
  const processedBody = header + rawBody + footer;

  if (!processedSubject) {
    return { success: false, error: "Assunto do email é obrigatório." };
  }

    const sendResult = await sendEmail(event.clinic_id, toEmail, processedSubject, processedBody, supabase);
    if (!sendResult.success) {
      return sendResult;
    }

    const { error: logError } = await supabase.from("message_log").insert({
      clinic_id: event.clinic_id,
      patient_id: null,
      appointment_id: null,
      channel: "email",
      type: event.event_code,
      metadata: { event_id: eventId, form_instance_id: metadata.form_instance_id },
    });
    if (logError) {
      console.error("[processEventByIdForPublicForm] message_log insert:", logError);
    }

    const { data: row } = await supabase.from("event_timeline").select("sent_channels").eq("id", eventId).single();
    const currentChannels = (row?.sent_channels as string[] | null) ?? [];
    const newSentChannels = currentChannels.includes("email") ? currentChannels : [...currentChannels, "email"];

    // Mantém status "pending": há ação recomendada (ex.: cadastrar funcionário); só registra que o email foi enviado
    await supabase
      .from("event_timeline")
      .update({ sent_channels: newSentChannels })
      .eq("id", eventId);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[processEventByIdForPublicForm]", err);
    return { success: false, error: message };
  }
}

export type MessagePreviewItem = {
  channel: MessageChannel;
  subject: string | null;
  body: string;
  templateName?: string;
};

/**
 * Gera o preview da mensagem que seria enviada para um evento (para página de teste).
 */
export async function getMessagePreview(
  eventId: string,
  clinicId: string
): Promise<{ preview: MessagePreviewItem[]; eventName?: string; patientName?: string; error?: string }> {
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("event_timeline")
    .select("patient_id, appointment_id, clinic_id, event_code, channels, template_ids, variables, metadata")
    .eq("id", eventId)
    .eq("clinic_id", clinicId)
    .single();

  if (eventError || !event) {
    return { preview: [], error: "Evento não encontrado." };
  }

  let channels = (event.channels as string[]) || [];
  const templateIds = (event.template_ids as Record<string, string>) || {};
  const result: MessagePreviewItem[] = [];

  // Formulário público sem paciente: usar canais habilitados nas configurações e contexto do metadata
  const isPublicForm = !event.patient_id && event.event_code === "public_form_completed";
  if (isPublicForm && channels.length === 0) {
    const { data: enabledChannels } = await supabase
      .from("clinic_message_settings")
      .select("channel")
      .eq("clinic_id", clinicId)
      .eq("event_code", event.event_code)
      .eq("enabled", true);
    channels = (enabledChannels ?? []).map((r) => r.channel);
  }

  let context: Awaited<ReturnType<typeof buildVariableContextFromIds>>;
  if (isPublicForm) {
    const metadata = (event.metadata as Record<string, unknown>) || {};
    const { data: clinic } = await supabase.from("clinics").select("name").eq("id", clinicId).single();
    context = await buildVariableContext({
      patient: {
        full_name: (metadata.public_submitter_name as string) || undefined,
        email: (metadata.public_submitter_email as string) || undefined,
        phone: (metadata.public_submitter_phone as string) || undefined,
        birth_date: (metadata.public_submitter_birth_date as string) || undefined,
      },
      clinic: clinic || undefined,
    });
  } else {
    context = await buildVariableContextFromIds(
      event.patient_id,
      event.appointment_id,
      event.clinic_id
    );
  }

  for (const ch of channels) {
    const channel = ch as MessageChannel;
    let templateId = templateIds[channel];

    if (!templateId) {
      const { data: setting } = await supabase
        .from("clinic_message_settings")
        .select("template_id")
        .eq("clinic_id", clinicId)
        .eq("event_code", event.event_code)
        .eq("channel", channel)
        .eq("enabled", true)
        .maybeSingle();
      templateId = setting?.template_id;
    }

    let template: { subject?: string | null; body_html: string; name?: string; email_header?: string | null; email_footer?: string | null } | null = null;

    if (templateId) {
      const { data: customTemplate } = await supabase
        .from("message_templates")
        .select("subject, body_html, name, email_header, email_footer")
        .eq("id", templateId)
        .eq("is_active", true)
        .single();
      template = customTemplate;
    }

    if (!template) {
      const { data: systemTemplate } = await supabase
        .from("system_message_templates")
        .select("subject, body_html, name, email_header, email_footer")
        .eq("event_code", event.event_code)
        .eq("channel", channel)
        .single();
      template = systemTemplate;
    }

    if (!template) {
      result.push({ channel, subject: null, body: "(Nenhum template configurado para este canal)", templateName: undefined });
      continue;
    }

    const subject = template.subject ? replaceVariables(template.subject, context) : null;
    const rawBody = replaceVariables(template.body_html || "", context);
    let body = rawBody;
    if (channel === "email") {
      const { data: clinicRow } = await supabase
        .from("clinics")
        .select("email_header, email_footer")
        .eq("id", clinicId)
        .single();
      const header = (clinicRow?.email_header && replaceVariables(clinicRow.email_header, context)) || "";
      const footer = (clinicRow?.email_footer && replaceVariables(clinicRow.email_footer, context)) || "";
      body = header + rawBody + footer;
    }
    result.push({ channel, subject, body, templateName: template.name });
  }

  let eventName: string | undefined;
  let patientName: string | undefined;
  const { data: me } = await supabase.from("message_events").select("name").eq("code", event.event_code).single();
  if (me) eventName = me.name;
  if (event.patient_id) {
    const { data: p } = await supabase.from("patients").select("full_name").eq("id", event.patient_id).single();
    if (p) patientName = p.full_name;
  } else if (isPublicForm && event.metadata) {
    const meta = event.metadata as Record<string, unknown>;
    patientName = (meta.public_submitter_name as string) || undefined;
  }

  return { preview: result, eventName, patientName };
}
