import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Inicia o fluxo OAuth simples do Meta/WhatsApp (sem Embedded Signup).
 * GET /api/integrations/whatsapp-simple/auth
 *
 * Fluxo simples: apenas autoriza o app e obtém token + phone_number_id.
 * Requer: META_APP_ID, META_APP_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/whatsapp-simple/callback`;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Meta App ID e App Secret não configurados" },
        { status: 500 }
      );
    }

    // Scopes necessários para descobrir WABAs e números automaticamente
    const scopes = [
      "whatsapp_business_management",
      "whatsapp_business_messaging",
      "business_management", // Necessário para acessar /me/businesses
    ];

    const state = JSON.stringify({
      clinicId: admin.clinicId,
      userId: admin.id,
    });

    // URL de autorização OAuth padrão (sem config_id)
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Erro ao iniciar OAuth Meta (simples):", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar autenticação" },
      { status: 500 }
    );
  }
}
