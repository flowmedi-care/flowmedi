import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface WhatsAppOptions {
  to: string; // Número no formato: 5511999999999 (código do país + DDD + número)
  template?: string; // Nome do template aprovado pela Meta
  templateParams?: string[]; // Parâmetros do template
  text?: string; // Mensagem de texto simples (para mensagens iniciadas pelo usuário)
}

/**
 * Obtém as credenciais do WhatsApp/Meta para uma clínica
 * Tenta primeiro whatsapp_simple, depois whatsapp_meta (coexistência)
 */
async function getWhatsAppCredentials(clinicId: string, preferSimple = true, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient ?? await createClient();
  
  const integrationType = preferSimple ? "whatsapp_simple" : "whatsapp_meta";
  
  let { data: integration, error } = await supabase
    .from("clinic_integrations")
    .select("credentials, metadata")
    .eq("clinic_id", clinicId)
    .eq("integration_type", integrationType)
    .eq("status", "connected")
    .single();

  // Se não encontrou e preferSimple=true, tentar whatsapp_meta
  if ((error || !integration) && preferSimple) {
    const fallback = await supabase
      .from("clinic_integrations")
      .select("credentials, metadata")
      .eq("clinic_id", clinicId)
      .eq("integration_type", "whatsapp_meta")
      .eq("status", "connected")
      .single();
    integration = fallback.data;
    error = fallback.error;
  }

  if (error || !integration) {
    throw new Error("Integração WhatsApp não encontrada ou não conectada");
  }

  return {
    credentials: integration.credentials as {
      access_token: string;
      expires_in: number | null;
      token_type: string;
    },
    phoneNumberId: (integration.metadata as { phone_number_id?: string })?.phone_number_id,
    wabaId: (integration.metadata as { waba_id?: string })?.waba_id,
  };
}

/**
 * Envia uma mensagem WhatsApp via Meta Cloud API
 */
export type SendWhatsAppResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  /** Debug: resposta bruta da Meta (sem token) */
  debug?: { status: number; metaResponse: unknown };
};

export async function sendWhatsAppMessage(
  clinicId: string,
  options: WhatsAppOptions,
  preferSimple = true,
  supabaseClient?: SupabaseClient
): Promise<SendWhatsAppResult> {
  try {
    const { credentials, phoneNumberId } = await getWhatsAppCredentials(clinicId, preferSimple, supabaseClient);

    if (!phoneNumberId) {
      throw new Error("Phone Number ID não configurado. Configure um número no Meta Business Manager.");
    }

    const apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    // Preparar payload baseado no tipo de mensagem
    let payload: Record<string, unknown>;

    if (options.template) {
      // Mensagem usando template aprovado pela Meta
      payload = {
        messaging_product: "whatsapp",
        to: options.to,
        type: "template",
        template: {
          name: options.template,
          language: {
            code: options.template === "hello_world" ? "en_US" : "pt_BR",
          },
          components: options.templateParams
            ? [
                {
                  type: "body",
                  parameters: options.templateParams.map((param) => ({
                    type: "text",
                    text: param,
                  })),
                },
              ]
            : undefined,
        },
      };
    } else if (options.text) {
      // Mensagem de texto simples (requer que o usuário tenha iniciado conversa nas últimas 24h)
      payload = {
        messaging_product: "whatsapp",
        to: options.to,
        type: "text",
        text: {
          body: options.text,
        },
      };
    } else {
      throw new Error("É necessário fornecer 'template' ou 'text'");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const debugPayload = { status: response.status, metaResponse: data };

    if (!response.ok) {
      const errorMessage = data.error?.message || "Erro ao enviar mensagem WhatsApp";
      const errorCode = data.error?.code;
      const errorSubcode = data.error?.error_subcode;

      // Atualizar status da integração se o token expirou
      if (data.error?.code === 190 || data.error?.type === "OAuthException") {
        const supabase = await createClient();
        await supabase
          .from("clinic_integrations")
          .update({
            status: "error",
            error_message: "Token de acesso expirado ou inválido",
          })
          .eq("clinic_id", clinicId)
          .in("integration_type", ["whatsapp_meta", "whatsapp_simple"]);
      }

      return {
        success: false,
        error: errorMessage,
        debug: debugPayload,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id || undefined,
      debug: debugPayload,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem WhatsApp",
      debug: { status: 0, metaResponse: String(error) },
    };
  }
}

/**
 * Verifica se a integração de WhatsApp está conectada e funcionando
 */
export async function checkWhatsAppIntegration(clinicId: string, preferSimple = true, supabaseClient?: SupabaseClient): Promise<{
  connected: boolean;
  phoneNumberId?: string;
  error?: string;
}> {
  try {
    const { phoneNumberId } = await getWhatsAppCredentials(clinicId, preferSimple, supabaseClient);
    return { connected: true, phoneNumberId: phoneNumberId || undefined };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Integração não encontrada",
    };
  }
}

/**
 * Verifica se há mensagem dentro da janela de 24h para um número
 * Verifica se há mensagem INBOUND (recebida) nas últimas 24h
 */
export async function isWithin24HourWindow(clinicId: string, phoneNumber: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Buscar conversa
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone_number", phoneNumber)
      .single();

    if (!conversation) {
      return false;
    }

    // Verificar se há mensagem recebida (inbound) nas últimas 24h
    const { data: recentMessage } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound")
      .gte("sent_at", twentyFourHoursAgo)
      .limit(1)
      .single();

    return !!recentMessage;
  } catch {
    return false;
  }
}
