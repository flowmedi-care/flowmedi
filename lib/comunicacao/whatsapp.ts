import { createClient } from "@/lib/supabase/server";

interface WhatsAppOptions {
  to: string; // Número no formato: 5511999999999 (código do país + DDD + número)
  template?: string; // Nome do template aprovado pela Meta
  templateParams?: string[]; // Parâmetros do template
  text?: string; // Mensagem de texto simples (para mensagens iniciadas pelo usuário)
}

/**
 * Obtém as credenciais do WhatsApp/Meta para uma clínica
 */
async function getWhatsAppCredentials(clinicId: string) {
  const supabase = await createClient();
  
  const { data: integration, error } = await supabase
    .from("clinic_integrations")
    .select("credentials, metadata")
    .eq("clinic_id", clinicId)
    .eq("integration_type", "whatsapp_meta")
    .eq("status", "connected")
    .single();

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
  options: WhatsAppOptions
): Promise<SendWhatsAppResult> {
  try {
    const { credentials, phoneNumberId } = await getWhatsAppCredentials(clinicId);

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

    console.log("[WhatsApp] Request:", { apiUrl, to: options.to, type: options.template ? "template" : "text", payloadKeys: Object.keys(payload) });

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

    console.log("[WhatsApp] Response:", debugPayload);

    if (!response.ok) {
      const errorMessage = data.error?.message || "Erro ao enviar mensagem WhatsApp";
      const errorCode = data.error?.code;
      const errorSubcode = data.error?.error_subcode;
      console.error("[WhatsApp] Erro Meta:", { message: errorMessage, code: errorCode, subcode: errorSubcode, full: data.error });

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
          .eq("integration_type", "whatsapp_meta");
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
    console.error("[WhatsApp] Exceção:", error);
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
export async function checkWhatsAppIntegration(clinicId: string): Promise<{
  connected: boolean;
  phoneNumberId?: string;
  error?: string;
}> {
  try {
    const { phoneNumberId } = await getWhatsAppCredentials(clinicId);
    return { connected: true, phoneNumberId: phoneNumberId || undefined };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Integração não encontrada",
    };
  }
}
