import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback do OAuth do Meta/WhatsApp Simple
 * GET /api/integrations/whatsapp-simple/callback
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
    const redirectUri = `${request.nextUrl.origin}/api/integrations/whatsapp-simple/callback`;

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
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=token_failed`, request.url)
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || null;

    // Obter informações do usuário/perfil
    const userInfoUrl = `https://graph.facebook.com/v21.0/me?access_token=${accessToken}&fields=id,name`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    // Tentar obter informações do WhatsApp Business Account (WABA)
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;

    try {
      // Buscar WABAs através de /me/businesses
      const wabaUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`;
      const wabaResponse = await fetch(wabaUrl);
      const wabaData = await wabaResponse.json();
      
      if (wabaData.data && wabaData.data.length > 0) {
        for (const business of wabaData.data) {
          wabaId = business.id;
          try {
            const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();
            
            if (phoneData.data && phoneData.data.length > 0) {
              phoneNumberId = phoneData.data[0].id;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Método 2: Se não encontrou, tentar /me/owned_whatsapp_business_accounts
      if (!phoneNumberId) {
        const ownedWabaUrl = `https://graph.facebook.com/v21.0/me/owned_whatsapp_business_accounts?access_token=${accessToken}`;
        const ownedWabaResponse = await fetch(ownedWabaUrl);
        const ownedWabaData = await ownedWabaResponse.json();
        
        if (ownedWabaData.data && ownedWabaData.data.length > 0) {
          wabaId = ownedWabaData.data[0].id;
          const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
          const phoneResponse = await fetch(phoneUrl);
          const phoneData = await phoneResponse.json();
          
          if (phoneData.data && phoneData.data.length > 0) {
            phoneNumberId = phoneData.data[0].id;
          }
        }
      }

      // Método 3: Buscar via app_id (para números de teste)
      if (!phoneNumberId && appId) {
        const testNumbersUrl = `https://graph.facebook.com/v21.0/${appId}/phone_numbers?access_token=${accessToken}`;
        const testNumbersResponse = await fetch(testNumbersUrl);
        const testNumbersData = await testNumbersResponse.json();
        if (testNumbersData.data && testNumbersData.data.length > 0) {
          phoneNumberId = testNumbersData.data[0].id;
        }
      }

      // Método 4: Buscar via /me/accounts (pode retornar WABAs)
      if (!phoneNumberId) {
        const accountsUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`;
        const accountsResponse = await fetch(accountsUrl);
        const accountsData = await accountsResponse.json();
        if (accountsData.data && accountsData.data.length > 0) {
          for (const account of accountsData.data) {
            try {
              const accountPhoneUrl = `https://graph.facebook.com/v21.0/${account.id}/phone_numbers?access_token=${accessToken}`;
              const accountPhoneResponse = await fetch(accountPhoneUrl);
              const accountPhoneData = await accountPhoneResponse.json();
              if (accountPhoneData.data && accountPhoneData.data.length > 0) {
                phoneNumberId = accountPhoneData.data[0].id;
                wabaId = account.id;
                break;
              }
            } catch {
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.warn("Erro ao obter informações do WABA:", error);
    }

    // Inscrever o app no WABA para webhooks
    if (wabaId && accessToken) {
      try {
        await fetch(`https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // Ignorar erro
      }
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

    const integrationStatus = accessToken ? "connected" : "pending";

    const { error: upsertError } = await supabase
      .from("clinic_integrations")
      .upsert(
        {
          clinic_id: stateData.clinicId,
          integration_type: "whatsapp_simple",
          status: integrationStatus,
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
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=save_failed`, request.url)
      );
    }

    // Redirecionar para página de configurações com sucesso
    const redirectUrl = new URL("/dashboard/configuracoes", request.url);
    redirectUrl.searchParams.set("integration", "whatsapp");
    redirectUrl.searchParams.set("status", integrationStatus);
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Erro no callback OAuth Meta:", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
