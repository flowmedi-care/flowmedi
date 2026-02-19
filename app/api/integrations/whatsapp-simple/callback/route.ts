import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Callback do OAuth simples do Meta/WhatsApp.
 * GET /api/integrations/whatsapp-simple/callback
 *
 * Obtém token, busca phone_number_id e faz register do número.
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

    let stateData: { clinicId: string; userId: string };
    try {
      stateData = JSON.parse(state);
    } catch {
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?error=invalid_state", request.url)
      );
    }

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

    // appId será usado para buscar números de teste

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
        new URL(`/dashboard/configuracoes?error=token_failed&debug=${encodeURIComponent(JSON.stringify({ error: tokenData.error }))}`, request.url)
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || null;

    // Buscar phone_number_id e WABA seguindo o fluxo correto:
    // User Token → /me/whatsapp_business_accounts → WABA → /WABA_ID/phone_numbers → Phone Number ID
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;

    const debugInfo: {
      wabaMethod1: { ok: boolean; status: number; dataCount: number; error?: unknown; wabas: Array<{ id: string }> } | null;
      phoneNumbers: Array<{ wabaId: string; phoneNumberId: string; display_phone_number?: string }>;
    } = {
      wabaMethod1: null,
      phoneNumbers: [],
    };

    try {
      // Método 1: Tentar /me/whatsapp_business_accounts (pode não existir no tipo User)
      const wabaUrl = `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?access_token=${accessToken}`;
      const wabaResponse = await fetch(wabaUrl);
      const wabaData = await wabaResponse.json();

      debugInfo.wabaMethod1 = {
        ok: wabaResponse.ok,
        status: wabaResponse.status,
        dataCount: wabaData.data?.length || 0,
        error: wabaData.error,
        wabas: wabaData.data?.map((w: { id: string }) => ({ id: w.id })) || [],
      };

      if (wabaData.data && wabaData.data.length > 0) {
        for (const waba of wabaData.data) {
          wabaId = waba.id;
          try {
            const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();

            if (phoneData.data && phoneData.data.length > 0 && phoneData.data[0].id && wabaId) {
              const foundPhoneNumberId = phoneData.data[0].id;
              phoneNumberId = foundPhoneNumberId;
              debugInfo.phoneNumbers.push({
                wabaId,
                phoneNumberId: foundPhoneNumberId,
                display_phone_number: phoneData.data[0].display_phone_number,
              });
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Método 2: Se não encontrou, tentar /me/businesses e depois buscar WABAs dentro de cada business
      if (!phoneNumberId) {
        const businessesUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`;
        const businessesResponse = await fetch(businessesUrl);
        const businessesData = await businessesResponse.json();

        if (businessesData.data && businessesData.data.length > 0) {
          for (const business of businessesData.data) {
            const businessId = business.id;
            try {
              const businessWabaUrl = `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
              const businessWabaResponse = await fetch(businessWabaUrl);
              const businessWabaData = await businessWabaResponse.json();

              if (businessWabaData.data && businessWabaData.data.length > 0) {
                for (const waba of businessWabaData.data) {
                  wabaId = waba.id;
                  try {
                    const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
                    const phoneResponse = await fetch(phoneUrl);
                    const phoneData = await phoneResponse.json();

                    if (phoneData.data && phoneData.data.length > 0 && phoneData.data[0].id && wabaId) {
                      const foundPhoneNumberId = phoneData.data[0].id;
                      phoneNumberId = foundPhoneNumberId;
                      debugInfo.phoneNumbers.push({
                        wabaId,
                        phoneNumberId: foundPhoneNumberId,
                        display_phone_number: phoneData.data[0].display_phone_number,
                      });
                      break;
                    }
                  } catch {
                    continue;
                  }
                }
                if (phoneNumberId) break;
              }
            } catch {
              continue;
            }
          }
        }
      }

      // Método 3: Tentar buscar números de teste através do app_id
      if (!phoneNumberId && appId) {
        try {
          const testNumbersUrl = `https://graph.facebook.com/v21.0/${appId}/phone_numbers?access_token=${accessToken}`;
          const testNumbersResponse = await fetch(testNumbersUrl);
          const testNumbersData = await testNumbersResponse.json();

          if (testNumbersData.data && testNumbersData.data.length > 0 && testNumbersData.data[0].id) {
            phoneNumberId = testNumbersData.data[0].id;
          }
        } catch {
          // Ignorar erro
        }
      }

      // Método 4: Tentar /me/owned_whatsapp_business_accounts (pode não existir)
      if (!phoneNumberId) {
        const ownedWabaUrl = `https://graph.facebook.com/v21.0/me/owned_whatsapp_business_accounts?access_token=${accessToken}`;
        const ownedWabaResponse = await fetch(ownedWabaUrl);
        const ownedWabaData = await ownedWabaResponse.json();

        if (ownedWabaData.data && ownedWabaData.data.length > 0) {
          wabaId = ownedWabaData.data[0].id;
          const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
          const phoneResponse = await fetch(phoneUrl);
          const phoneData = await phoneResponse.json();

          if (phoneData.data && phoneData.data.length > 0 && phoneData.data[0].id && wabaId) {
            const foundPhoneNumberId = phoneData.data[0].id;
            phoneNumberId = foundPhoneNumberId;
            debugInfo.phoneNumbers.push({
              wabaId,
              phoneNumberId: foundPhoneNumberId,
              display_phone_number: phoneData.data[0].display_phone_number,
            });
          }
        }
      }
    } catch {
      // Ignorar erros silenciosamente
    }

    // Inscrever app no WABA para receber webhooks
    if (wabaId && accessToken) {
      try {
        const subscribeUrl = `https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`;
        await fetch(subscribeUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // Ignorar erro
      }
    }

    // Registrar número com PIN (se configurado)
    const registerPin = process.env.META_WHATSAPP_REGISTER_PIN?.trim();
    if (phoneNumberId && accessToken && registerPin && /^\d{6}$/.test(registerPin)) {
      try {
        const registerUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/register`;
        await fetch(registerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            pin: registerPin,
          }),
        });
      } catch {
        // Ignorar erro
      }
    }

    // Salvar integração
    const credentials = {
      access_token: accessToken,
      expires_in: expiresIn,
      token_type: tokenData.token_type || "bearer",
    };

    const metadata: Record<string, unknown> = {
      phone_number_id: phoneNumberId || null,
      waba_id: wabaId || null,
      phone_number_status: phoneNumberId ? "found" : "not_found",
      debug_info: {
        wabaMethod1Found: debugInfo.wabaMethod1 ? debugInfo.wabaMethod1.dataCount > 0 : false,
        wabaMethod1Error: debugInfo.wabaMethod1?.error,
        wabaMethod1Status: debugInfo.wabaMethod1?.status,
        phoneNumbersCount: debugInfo.phoneNumbers.length,
      },
    };

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
    redirectUrl.searchParams.set("integration", "whatsapp_simple");
    redirectUrl.searchParams.set("status", integrationStatus);
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
