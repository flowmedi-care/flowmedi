import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Inicia o fluxo de Cadastro Incorporado (Embedded Signup) do Meta/WhatsApp — coexistência.
 * GET /api/integrations/whatsapp/auth
 *
 * Requer: META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID.
 * No painel Meta: Login com o Facebook > URIs de redirecionamento; Configurações > Básica > Domínios;
 * Cadastro Incorporado > Gerenciamento de domínios — todos devem incluir a origem do app.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/whatsapp/callback`;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Meta App ID e App Secret não configurados" },
        { status: 500 }
      );
    }

    if (!configId) {
      return NextResponse.json(
        {
          error:
            "META_EMBEDDED_SIGNUP_CONFIG_ID não configurado. Configure o Cadastro Incorporado no app Meta (Casos de uso > WhatsApp > Personalizar > Configurar cadastro incorporado) e defina a variável de ambiente.",
        },
        { status: 500 }
      );
    }

    // Scopes para coexistência (Embedded Signup): inclui business_management
    const scopes = [
      "whatsapp_business_management",
      "whatsapp_business_messaging",
      "business_management",
    ];

    const state = JSON.stringify({
      clinicId: admin.clinicId,
      userId: admin.id,
    });

    // URL de autorização com config_id = Cadastro Incorporado (coexistência)
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("config_id", configId);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Erro ao iniciar OAuth Meta (Embedded Signup):", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar autenticação" },
      { status: 500 }
    );
  }
}
