import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Callback do OAuth do Meta/WhatsApp
 * GET /api/integrations/whatsapp/callback
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
    const error = searchParams.get("error");

    // Verificar se houve erro no OAuth
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=oauth_error&message=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=oauth_failed", request.url)
      );
    }

    // Parse do state
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

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/integrations/whatsapp/callback`;

    if (!appId || !appSecret) {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=config_missing", request.url)
      );
    }

    // Trocar código por access token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Erro ao obter token:", tokenData);
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=token_failed", request.url)
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || null;

    // Obter informações do usuário/perfil
    const userInfoUrl = `https://graph.facebook.com/v21.0/me?access_token=${accessToken}&fields=id,name`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    // Tentar obter informações do WhatsApp Business Account (WABA)
    // Nota: Isso pode requerer permissões adicionais e configuração no Meta Business Manager
    let phoneNumberId = null;
    let wabaId = null;

    try {
      // Buscar WABAs associados
      const wabaUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`;
      const wabaResponse = await fetch(wabaUrl);
      const wabaData = await wabaResponse.json();
      
      // Se houver WABAs, pegar o primeiro e buscar números
      if (wabaData.data && wabaData.data.length > 0) {
        wabaId = wabaData.data[0].id;
        // Buscar números de telefone do WABA
        const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
        const phoneResponse = await fetch(phoneUrl);
        const phoneData = await phoneResponse.json();
        
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
        }
      }
    } catch (error) {
      console.warn("Não foi possível obter informações do WABA:", error);
      // Continuar mesmo sem WABA - o usuário pode configurar depois
    }

    // Salvar ou atualizar integração no banco
    const credentials = {
      access_token: accessToken,
      expires_in: expiresIn,
      token_type: tokenData.token_type || "bearer",
    };

    const metadata: Record<string, unknown> = {
      user_id: userInfo.id,
      user_name: userInfo.name,
    };

    if (phoneNumberId) {
      metadata.phone_number_id = phoneNumberId;
    }
    if (wabaId) {
      metadata.waba_id = wabaId;
    }

    const { error: upsertError } = await supabase
      .from("clinic_integrations")
      .upsert(
        {
          clinic_id: stateData.clinicId,
          integration_type: "whatsapp_meta",
          status: phoneNumberId ? "connected" : "pending", // Pending se não tiver número configurado
          credentials: credentials,
          metadata: metadata,
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
      new URL("/dashboard/configuracoes?integration=whatsapp&status=connected", request.url)
    );
  } catch (error) {
    console.error("Erro no callback OAuth Meta:", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
