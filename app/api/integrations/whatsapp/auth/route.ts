import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Inicia o fluxo OAuth do Meta/WhatsApp
 * GET /api/integrations/whatsapp/auth
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();

    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get("redirect_uri") || 
      `${request.nextUrl.origin}/api/integrations/whatsapp/callback`;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Meta App ID e App Secret não configurados" },
        { status: 500 }
      );
    }

    // Scopes necessários para WhatsApp Business API
    const scopes = [
      "whatsapp_business_management",
      "whatsapp_business_messaging",
    ];

    // State para segurança (inclui clinicId e userId)
    const state = JSON.stringify({
      clinicId: admin.clinicId,
      userId: admin.id,
    });

    // URL de autorização do Meta
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Erro ao iniciar OAuth Meta:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar autenticação" },
      { status: 500 }
    );
  }
}
