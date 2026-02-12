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

/**
 * Processa um evento e cria mensagem (automática ou pendente)
 */
export async function processMessageEvent(
  eventCode: string,
  clinicId: string,
  patientId: string,
  appointmentId: string | null,
  channel: MessageChannel
): Promise<ProcessMessageResult> {
  const supabase = await createClient();

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
      const integrationCheck = await checkEmailIntegration(clinicId);
      
      if (!integrationCheck.connected) {
        return {
          success: false,
          error: "Integração Google não conectada. Conecte em Configurações → Integrações",
        };
      }
    }

    // 2. Verificar consentimento LGPD
    const { data: consent } = await supabase
      .from("consents")
      .select("id")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!consent) {
      return {
        success: false,
        error: "Paciente não possui consentimento LGPD",
      };
    }

    // 3. Buscar template
    let template;
    if (setting.template_id) {
      const { data: customTemplate } = await supabase
        .from("message_templates")
        .select("*")
        .eq("id", setting.template_id)
        .eq("is_active", true)
        .single();

      if (customTemplate) {
        template = customTemplate;
      }
    }

    // Se não tem template customizado, usar template padrão (quando implementado)
    if (!template) {
      // Por enquanto, retornar erro se não houver template
      return {
        success: false,
        error: "Template não encontrado. Crie um template para este evento.",
      };
    }

    // 4. Buscar dados para variáveis
    const context = await buildVariableContextFromIds(
      patientId,
      appointmentId,
      clinicId
    );

    // 5. Processar template (substituir variáveis)
    const processedSubject = template.subject
      ? replaceVariables(template.subject, context)
      : null;
    const processedBody = replaceVariables(template.body_html, context);

    // 6. Se modo automático, enviar diretamente
    if (setting.send_mode === "automatic") {
      return await sendMessage(
        channel,
        clinicId,
        patientId,
        appointmentId,
        eventCode,
        template.id,
        processedSubject,
        processedBody,
        context
      );
    }

    // 7. Se modo manual, criar mensagem pendente
    const { data: pendingMessage, error: pendingError } = await supabase
      .from("pending_messages")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        appointment_id: appointmentId,
        event_code: eventCode,
        channel,
        template_id: template.id,
        variables: context as any,
        processed_body: processedBody,
        status: "pending",
        suggested_by: null, // Pode ser preenchido depois se necessário
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
  clinicId: string
) {
  const supabase = await createClient();

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

    // Buscar formulário se houver
    const { data: formData } = await supabase
      .from("form_instances")
      .select(`
        link_token,
        form_template:form_templates(name)
      `)
      .eq("appointment_id", appointmentId)
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
  templateId: string,
  subject: string | null,
  body: string,
  variables: any
): Promise<ProcessMessageResult> {
  const supabase = await createClient();

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

    let sendResult;

    if (channel === "email") {
      if (!patient.email) {
        return { success: false, error: "Paciente não possui email cadastrado" };
      }

      if (!subject) {
        return { success: false, error: "Assunto do email é obrigatório" };
      }

      // Verificar se integração Google está conectada
      const { checkEmailIntegration } = await import("@/lib/comunicacao/email");
      const integrationCheck = await checkEmailIntegration(clinicId);
      
      if (!integrationCheck.connected) {
        return {
          success: false,
          error: integrationCheck.error || "Integração Google não conectada. Conecte em Configurações → Integrações",
        };
      }

      sendResult = await sendEmail(clinicId, patient.email, subject, body);
    } else {
      // WhatsApp
      if (!patient.phone) {
        return {
          success: false,
          error: "Paciente não possui telefone cadastrado",
        };
      }

      sendResult = await sendWhatsApp(patient.phone, body);
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
 * Envia email usando Gmail API (via OAuth Google)
 */
async function sendEmail(
  clinicId: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<ProcessMessageResult> {
  try {
    // Usar a função de email existente que usa Gmail API
    const { sendEmail: sendEmailViaGmail } = await import("@/lib/comunicacao/email");
    
    const result = await sendEmailViaGmail(clinicId, {
      to,
      subject,
      html: htmlBody,
      body: htmlBody.replace(/<[^>]*>/g, ""), // Versão texto simples (remove HTML tags)
    });

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
 * Envia WhatsApp (estrutura pronta, implementação depois)
 */
async function sendWhatsApp(
  phone: string,
  message: string
): Promise<ProcessMessageResult> {
  // TODO: Implementar integração com WhatsApp Business API
  // Por enquanto, retorna erro informando que não está implementado

  return {
    success: false,
    error: "Integração com WhatsApp ainda não implementada",
  };
}
