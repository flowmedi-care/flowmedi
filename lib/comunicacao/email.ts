import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

/**
 * Obtém as credenciais OAuth do Google para uma clínica
 */
async function getGoogleCredentials(clinicId: string) {
  const supabase = await createClient();
  
  const { data: integration, error } = await supabase
    .from("clinic_integrations")
    .select("credentials, metadata")
    .eq("clinic_id", clinicId)
    .eq("integration_type", "email_google")
    .eq("status", "connected")
    .single();

  if (error || !integration) {
    throw new Error("Integração Google não encontrada ou não conectada");
  }

  return {
    credentials: integration.credentials as {
      access_token: string;
      refresh_token: string | null;
      expiry_date: number | null;
    },
    email: (integration.metadata as { email?: string })?.email,
  };
}

/**
 * Cria um cliente OAuth2 do Google com refresh automático de token
 */
async function createOAuthClient(clinicId: string) {
  const { credentials } = await getGoogleCredentials(clinicId);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token || undefined,
    expiry_date: credentials.expiry_date || undefined,
  });

  // Verificar se o token expirou e renovar se necessário
  if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
    if (!credentials.refresh_token) {
      throw new Error("Token expirado e sem refresh_token disponível");
    }

    try {
      const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
      
      // Atualizar no banco
      const supabase = await createClient();
      await supabase
        .from("clinic_integrations")
        .update({
          credentials: {
            access_token: newCredentials.access_token,
            refresh_token: newCredentials.refresh_token || credentials.refresh_token,
            expiry_date: newCredentials.expiry_date,
          },
          last_sync_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinicId)
        .eq("integration_type", "email_google");

      oauth2Client.setCredentials(newCredentials);
    } catch (error) {
      // Se falhar ao renovar, marcar como erro
      const supabase = await createClient();
      await supabase
        .from("clinic_integrations")
        .update({
          status: "error",
          error_message: "Falha ao renovar token de acesso",
        })
        .eq("clinic_id", clinicId)
        .eq("integration_type", "email_google");

      throw new Error("Falha ao renovar token de acesso");
    }
  }

  return oauth2Client;
}

/**
 * Envia um email via Gmail API
 */
export async function sendEmail(
  clinicId: string,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const oauth2Client = await createOAuthClient(clinicId);
    const { email: fromEmail } = await getGoogleCredentials(clinicId);

    if (!fromEmail) {
      throw new Error("Email do remetente não encontrado");
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Criar mensagem em formato RFC 2822
    const messageParts = [
      `To: ${options.to}`,
      `From: ${fromEmail}`,
      `Subject: ${options.subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      options.html || options.body.replace(/\n/g, "<br>"),
    ];

    const message = messageParts.join("\n");

    // Codificar em base64url
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: data.id || undefined,
    };
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email",
    };
  }
}

/**
 * Verifica se a integração de email está conectada e funcionando
 */
export async function checkEmailIntegration(clinicId: string): Promise<{
  connected: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const { email } = await getGoogleCredentials(clinicId);
    return { connected: true, email };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Integração não encontrada",
    };
  }
}
