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

    console.log("[WhatsApp OAuth] 4️⃣ Callback recebido:", {
      hasCode: !!code,
      codeLength: code?.length ?? 0,
      hasState: !!state,
      error: error ?? null,
    });

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

    // Trocar código por access token (v19 conforme doc Meta)
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    console.log("[WhatsApp OAuth] 5️⃣ Token exchange:", {
      status: tokenResponse.status,
      hasAccessToken: !!tokenData.access_token,
      expiresIn: tokenData.expires_in ?? null,
      error: tokenData.error?.message ?? null,
    });

    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=token_failed`, request.url)
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || null;

    console.log("[WhatsApp OAuth] ✅ User Access Token obtido (truncado):", accessToken?.slice(0, 20) + "...");

    // Obter informações do usuário/perfil
    const userInfoResponse = await fetch(
      "https://graph.facebook.com/v19.0/me?fields=id,name",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userInfo = await userInfoResponse.json();
    console.log("[WhatsApp OAuth] User info:", { id: userInfo.id, name: userInfo.name, error: userInfo.error?.message });

    // Obter WABA e Phone Number ID — seguir doc Meta:
    // 1) GET me/whatsapp_business_accounts → waba_id
    // 2) GET {waba_id}/phone_numbers → phone_number_id (o "id" na resposta)
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;

    const bearer = { Authorization: `Bearer ${accessToken}` };

    try {
      // PASSO 1: me/businesses → BUSINESS_ID
      // PASSO 2: BUSINESS_ID/owned_whatsapp_business_accounts → WABA_ID
      // PASSO 3: WABA_ID/phone_numbers → PHONE_NUMBER_ID
      const businessesRes = await fetch(
        "https://graph.facebook.com/v19.0/me/businesses",
        { headers: bearer }
      );
      const businessesData = await businessesRes.json();

      console.log("[WhatsApp OAuth] 6️⃣ PASSO 1 me/businesses:", {
        status: businessesRes.status,
        count: businessesData.data?.length ?? 0,
        businesses: businessesData.data?.map((b: { id: string; name?: string }) => ({ id: b.id, name: b.name })) ?? [],
        error: businessesData.error?.message ?? null,
      });

      if (businessesData.data?.length) {
        for (const business of businessesData.data) {
          const wabaRes = await fetch(
            `https://graph.facebook.com/v19.0/${business.id}/owned_whatsapp_business_accounts`,
            { headers: bearer }
          );
          const wabaData = await wabaRes.json();

          console.log("[WhatsApp OAuth] 6b PASSO 2 business", business.id, "owned_whatsapp_business_accounts:", {
            status: wabaRes.status,
            count: wabaData.data?.length ?? 0,
            wabas: wabaData.data?.map((w: { id: string; name?: string }) => ({ id: w.id, name: w.name })) ?? [],
            error: wabaData.error?.message ?? null,
          });

          if (wabaData.data?.length) {
            wabaId = wabaData.data[0].id;
            const phoneRes = await fetch(
              `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`,
              { headers: bearer }
            );
            const phoneData = await phoneRes.json();

            console.log("[WhatsApp OAuth] 7️⃣ PASSO 3 WABA", wabaId, "phone_numbers:", {
              status: phoneRes.status,
              count: phoneData.data?.length ?? 0,
              phones: phoneData.data?.map((p: { id: string; display_phone_number?: string }) => ({ id: p.id, display: p.display_phone_number })) ?? [],
              error: phoneData.error?.message ?? null,
            });

            if (phoneData.data?.length) {
              phoneNumberId = phoneData.data[0].id;
              console.log("[WhatsApp OAuth] ✅ Phone Number ID encontrado:", phoneNumberId, "display:", phoneData.data[0].display_phone_number);
              break;
            }
          }
        }
      }

      // Fallback: /me/accounts (Pages/contas)
      if (!phoneNumberId) {
        console.log("[WhatsApp OAuth] Fallback: tentando /me/accounts");
        const accountsRes = await fetch(
          "https://graph.facebook.com/v19.0/me/accounts",
          { headers: bearer }
        );
        const accountsData = await accountsRes.json();
        if (accountsData.data && accountsData.data.length > 0) {
          for (const account of accountsData.data) {
            try {
              const accountPhoneRes = await fetch(
                `https://graph.facebook.com/v19.0/${account.id}/phone_numbers`,
                { headers: bearer }
              );
              const accountPhoneData = await accountPhoneRes.json();
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
      console.error("[WhatsApp OAuth] ❌ Erro ao obter WABA/phone_numbers:", error);
    }

    console.log("[WhatsApp OAuth] 8️⃣ Resumo antes de salvar:", {
      phoneNumberId: phoneNumberId ?? "null",
      wabaId: wabaId ?? "null",
      hasAccessToken: !!accessToken,
    });

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
      console.error("[WhatsApp OAuth] ❌ Erro ao salvar no banco:", upsertError);
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=save_failed`, request.url)
      );
    }

    console.log("[WhatsApp OAuth] ✅ Integração salva:", {
      clinicId: stateData.clinicId,
      phoneNumberId: phoneNumberId ?? "null",
      wabaId: wabaId ?? "null",
      status: integrationStatus,
    });

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
