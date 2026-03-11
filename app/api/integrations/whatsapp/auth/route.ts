import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";

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
    await requireClinicAdmin();
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/whatsapp/callback`;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const rawConfigId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;
    const configId = rawConfigId
      ? rawConfigId.trim().replace(/^['"]+|['"]+$/g, "")
      : "";
    const graphVersion = process.env.META_GRAPH_VERSION || "v25.0";

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

    if (!/^\d+$/.test(configId)) {
      return NextResponse.json(
        {
          error:
            "META_EMBEDDED_SIGNUP_CONFIG_ID inválido. Use o ID numérico real da configuração do Cadastro Incorporado (ex.: 786102290758591).",
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

    const embeddedExtras = {
      setup: {
        business: {
          id: null,
          name: null,
          email: null,
          phone: { code: null, number: null },
          website: null,
          address: {
            streetAddress1: null,
            streetAddress2: null,
            city: null,
            state: null,
            zipPostal: null,
            country: null,
          },
          timezone: null,
        },
        phone: {
          displayName: null,
          category: null,
          description: null,
        },
        preVerifiedPhone: { ids: null },
        solutionID: null,
        whatsAppBusinessAccount: { ids: null },
      },
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: "3",
      version: "v3",
      features: [{ name: "marketing_messages_lite" }, { name: "app_only_install" }],
    };

    // URL fallback (sem SDK) para depuração, mantendo o fluxo oficial de code exchange.
    const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("display", "popup");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("override_default_response_type", "true");
    authUrl.searchParams.set("config_id", configId);
    authUrl.searchParams.set("extras", JSON.stringify(embeddedExtras));

    return NextResponse.json({
      authUrl: authUrl.toString(),
      embeddedSignup: {
        appId,
        configId,
        graphVersion,
        extras: embeddedExtras,
      },
    });
  } catch (error) {
    console.error("Erro ao iniciar OAuth Meta (Embedded Signup):", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar autenticação" },
      { status: 500 }
    );
  }
}
