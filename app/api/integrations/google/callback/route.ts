import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";
import { redirect } from "next/navigation";

/**
 * Callback do OAuth do Google
 * GET /api/integrations/google/callback
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/entrar", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=oauth_failed", request.url)
      );
    }

    // Parse do state para obter clinicId
    let stateData: { clinicId: string; userId: string };
    try {
      stateData = JSON.parse(state);
    } catch {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=invalid_state", request.url)
      );
    }

    // Verificar se o usuário é admin da clínica
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, clinic_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || profile.clinic_id !== stateData.clinicId) {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=unauthorized", request.url)
      );
    }

    // Configurar OAuth2 client
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Trocar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=no_token", request.url)
      );
    }

    // Obter email do usuário
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const email = userInfo.email;

    if (!email) {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=no_email", request.url)
      );
    }

    // Salvar ou atualizar integração no banco
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
    };

    const { error: upsertError } = await supabase
      .from("clinic_integrations")
      .upsert(
        {
          clinic_id: stateData.clinicId,
          integration_type: "email_google",
          status: "connected",
          credentials: credentials,
          metadata: { email },
          connected_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
        },
        {
          onConflict: "clinic_id,integration_type",
        }
      );

    if (upsertError) {
      console.error("Erro ao salvar integração:", upsertError);
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=save_failed", request.url)
      );
    }

    // Redirecionar para página de configurações com sucesso
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?integration=email&status=connected", request.url)
    );
  } catch (error) {
    console.error("Erro no callback OAuth Google:", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
