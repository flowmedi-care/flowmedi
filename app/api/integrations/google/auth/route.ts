import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { google } from "googleapis";

/**
 * Inicia o fluxo OAuth do Google
 * GET /api/integrations/google/auth
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get("redirect_uri") || 
      `${request.nextUrl.origin}/api/integrations/google/callback`;

    // Configurar OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Scopes necessários para enviar emails via Gmail API
    const scopes = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    // Gerar URL de autorização
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Para obter refresh_token
      prompt: "consent", // Força mostrar tela de consentimento para garantir refresh_token
      scope: scopes,
      state: JSON.stringify({
        clinicId: admin.clinicId,
        userId: admin.id,
      }),
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Erro ao iniciar OAuth Google:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar autenticação" },
      { status: 500 }
    );
  }
}
