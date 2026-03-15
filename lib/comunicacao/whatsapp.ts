import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface WhatsAppOptions {
  to: string; // Número no formato: 5511999999999 (código do país + DDD + número)
  template?: string; // Nome do template aprovado pela Meta
  templateParams?: string[]; // Parâmetros do template
  text?: string; // Mensagem de texto simples (para mensagens iniciadas pelo usuário)
}

export type WhatsAppTemplateReviewStatus =
  | "APPROVED"
  | "IN_REVIEW"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "PENDING";

interface SubmitTemplateOptions {
  templateRecordId: string;
  templateBodyText: string;
}

export interface CreateMetaTemplateOptions {
  name: string;
  bodyText: string;
  language?: string;
  category?: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  components?: Array<Record<string, unknown>>;
}

export interface MetaTemplateSummary {
  id: string;
  name: string;
  status: WhatsAppTemplateReviewStatus;
  language?: string;
}

/**
 * Obtém as credenciais do WhatsApp/Meta para uma clínica.
 *
 * Regra de escolha:
 * 1) Se houver `whatsapp_meta` com WABA/Phone configurado, prioriza ela
 *    (evita usar integração legada e puxar dados de conta errada).
 * 2) Caso contrário, respeita `preferSimple` para fallback legado.
 */
async function getWhatsAppCredentials(clinicId: string, preferSimple = false, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient ?? await createClient();

  const { data: rows, error } = await supabase
    .from("clinic_integrations")
    .select("integration_type, credentials, metadata")
    .eq("clinic_id", clinicId)
    .in("integration_type", ["whatsapp_simple", "whatsapp_meta"])
    .eq("status", "connected")
    .returns<Array<{
      integration_type: "whatsapp_simple" | "whatsapp_meta";
      credentials: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    }>>();

  if (error || !rows || rows.length === 0) {
    throw new Error("Integração WhatsApp não encontrada ou não conectada");
  }

  const simpleIntegration = rows.find((row) => row.integration_type === "whatsapp_simple");
  const metaIntegration = rows.find((row) => row.integration_type === "whatsapp_meta");

  const integration = preferSimple
    ? (simpleIntegration ?? metaIntegration)
    : metaIntegration;

  if (!integration) {
    if (!preferSimple && simpleIntegration) {
      throw new Error(
        "Integração WhatsApp Simples detectada, mas está desativada. Conecte via Cadastro Incorporado (WhatsApp Meta)."
      );
    }
    throw new Error("Integração WhatsApp conectada não encontrada");
  }

  return {
    credentials: (integration.credentials ?? {}) as {
      access_token: string;
      expires_in: number | null;
      token_type: string;
    },
    phoneNumberId: (integration.metadata as { phone_number_id?: string })?.phone_number_id,
    wabaId: (integration.metadata as { waba_id?: string })?.waba_id,
  };
}

function sanitizeMetaTemplateName(rawName: string): string {
  return rawName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

function toMetaTemplateStatus(status: string | undefined): WhatsAppTemplateReviewStatus {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "PAUSED":
      return "PAUSED";
    case "DISABLED":
      return "DISABLED";
    case "IN_REVIEW":
      return "IN_REVIEW";
    default:
      return "PENDING";
  }
}

function buildBodyTextExample(bodyText: string): string[][] {
  const matches = bodyText.match(/\{\{\d+\}\}/g) ?? [];
  const count = Math.min(Math.max(matches.length, 1), 10);
  const sampleValues = [
    "Paciente",
    "Mensagem da clínica",
    "Equipe da clínica",
    "Informação adicional",
    "Detalhe",
    "Complemento",
    "Contexto",
    "Aviso",
    "Instrução",
    "Final",
  ];
  return [sampleValues.slice(0, count)];
}

export async function submitTemplateForApproval(
  clinicId: string,
  options: SubmitTemplateOptions,
  supabaseClient?: SupabaseClient
): Promise<{
  success: boolean;
  templateName?: string;
  templateId?: string;
  status?: WhatsAppTemplateReviewStatus;
  error?: string;
}> {
  try {
    const { credentials, wabaId } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    if (!wabaId) {
      return { success: false, error: "WABA ID não encontrado na integração WhatsApp." };
    }

    const clinicSuffix = clinicId.replace(/-/g, "").slice(0, 10);
    const templateSuffix = options.templateRecordId.replace(/-/g, "").slice(0, 10);
    const versionSuffix = Date.now().toString(36);
    const templateName = sanitizeMetaTemplateName(
      `flowmedi_${clinicSuffix}_${templateSuffix}_${versionSuffix}`
    );

    const templateBody = options.templateBodyText?.trim() || "Olá {{1}}! {{2}} {{3}}";
    const createUrl = `https://graph.facebook.com/v23.0/${wabaId}/message_templates`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        name: templateName,
        category: "UTILITY",
        language: "pt_BR",
        parameter_format: "positional",
        components: [
          {
            type: "BODY",
            text: templateBody,
            example: {
              body_text: buildBodyTextExample(templateBody),
            },
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const msg =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        "Erro ao submeter template para aprovação na Meta.";
      return {
        success: false,
        error: msg,
      };
    }

    return {
      success: true,
      templateName,
      templateId: data?.id ? String(data.id) : undefined,
      status: toMetaTemplateStatus(data?.status),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao submeter template para aprovação.",
    };
  }
}

export async function listMetaTemplates(
  clinicId: string,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; templates?: MetaTemplateSummary[]; error?: string }> {
  try {
    const { credentials, wabaId } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    if (!wabaId) {
      return { success: false, error: "WABA ID não encontrado na integração WhatsApp." };
    }

    const url = `https://graph.facebook.com/v23.0/${wabaId}/message_templates?fields=id,name,status,language&limit=100`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || "Erro ao listar templates da Meta.",
      };
    }

    const templates = Array.isArray(data?.data)
      ? data.data.map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          status: toMetaTemplateStatus(typeof row.status === "string" ? row.status : undefined),
          language: typeof row.language === "string" ? row.language : undefined,
        }))
      : [];

    return { success: true, templates };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao listar templates.",
    };
  }
}

export async function createMetaTemplate(
  clinicId: string,
  options: CreateMetaTemplateOptions,
  supabaseClient?: SupabaseClient
): Promise<{
  success: boolean;
  templateName?: string;
  templateId?: string;
  status?: WhatsAppTemplateReviewStatus;
  error?: string;
}> {
  try {
    const { credentials, wabaId } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    if (!wabaId) {
      return { success: false, error: "WABA ID não encontrado na integração WhatsApp." };
    }

    const templateName = sanitizeMetaTemplateName(options.name);
    const language = options.language || "pt_BR";
    const category = options.category || "UTILITY";
    const components = Array.isArray(options.components) && options.components.length > 0
      ? options.components
      : [
          {
            type: "BODY",
            text: options.bodyText,
            example: {
              body_text: buildBodyTextExample(options.bodyText),
            },
          },
        ];
    const createUrl = `https://graph.facebook.com/v23.0/${wabaId}/message_templates`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.access_token}`,
      },
      body: JSON.stringify({
        name: templateName,
        category,
        language,
        parameter_format: "positional",
        components,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const msg =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        "Erro ao criar template na Meta.";
      return {
        success: false,
        error: msg,
      };
    }

    return {
      success: true,
      templateName,
      templateId: data?.id ? String(data.id) : undefined,
      status: toMetaTemplateStatus(data?.status),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao criar template na Meta.",
    };
  }
}

export async function fetchTemplateStatus(
  clinicId: string,
  templateId: string,
  supabaseClient?: SupabaseClient
): Promise<{
  success: boolean;
  status?: WhatsAppTemplateReviewStatus;
  error?: string;
}> {
  try {
    const { credentials } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    const url = `https://graph.facebook.com/v23.0/${templateId}?fields=status`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || "Erro ao consultar status do template na Meta.",
      };
    }
    return {
      success: true,
      status: toMetaTemplateStatus(data?.status),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao consultar status do template.",
    };
  }
}

export async function fetchTemplateDetails(
  clinicId: string,
  templateId: string,
  supabaseClient?: SupabaseClient
): Promise<{
  success: boolean;
  name?: string;
  status?: WhatsAppTemplateReviewStatus;
  bodyText?: string;
  error?: string;
}> {
  try {
    const { credentials } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    const url = `https://graph.facebook.com/v23.0/${templateId}?fields=id,name,status,components`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || "Erro ao consultar dados do template na Meta.",
      };
    }
    return {
      success: true,
      name: typeof data?.name === "string" ? data.name : undefined,
      status: toMetaTemplateStatus(data?.status),
      bodyText: Array.isArray(data?.components)
        ? (
            data.components.find(
              (component: Record<string, unknown>) =>
                String(component?.type || "").toUpperCase() === "BODY"
            ) as Record<string, unknown> | undefined
          )?.text as string | undefined
        : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao consultar dados do template.",
    };
  }
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
  preferSimple = false,
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
export async function checkWhatsAppIntegration(clinicId: string, preferSimple = false, supabaseClient?: SupabaseClient): Promise<{
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
