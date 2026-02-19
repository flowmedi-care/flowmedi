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

    console.log("🔑 [WhatsApp Simple Callback] Token Response:", {
      ok: tokenResponse.ok,
      status: tokenResponse.status,
      hasToken: !!tokenData.access_token,
      error: tokenData.error,
      expiresIn: tokenData.expires_in,
      scopes: tokenData.scopes || "não informado",
    });

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("❌ [WhatsApp Simple Callback] Erro ao obter token:", tokenData);
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
      console.log("📋 [WhatsApp Simple Callback] Tentando buscar WABAs via /me/whatsapp_business_accounts...");
      const wabaUrl = `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?access_token=${accessToken}`;
      const wabaResponse = await fetch(wabaUrl);
      const wabaData = await wabaResponse.json();

      console.log("📋 [WhatsApp Simple Callback] WABA Response (/me/whatsapp_business_accounts):", {
        ok: wabaResponse.ok,
        status: wabaResponse.status,
        dataCount: wabaData.data?.length || 0,
        error: wabaData.error,
        fullResponse: wabaData,
      });

      debugInfo.wabaMethod1 = {
        ok: wabaResponse.ok,
        status: wabaResponse.status,
        dataCount: wabaData.data?.length || 0,
        error: wabaData.error,
        wabas: wabaData.data?.map((w: { id: string }) => ({ id: w.id })) || [],
      };

      if (wabaData.data && wabaData.data.length > 0) {
        // Tentar todos os WABAs até encontrar um número
        for (const waba of wabaData.data) {
          wabaId = waba.id;
          console.log(`📞 [WhatsApp Simple Callback] Buscando números para WABA ${wabaId}...`);
          
          try {
            const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();

            console.log(`📞 [WhatsApp Simple Callback] Phone Numbers para WABA ${wabaId}:`, {
              ok: phoneResponse.ok,
              status: phoneResponse.status,
              count: phoneData.data?.length || 0,
              error: phoneData.error,
              fullResponse: phoneData,
              numbers: phoneData.data?.map((p: { id: string; display_phone_number?: string }) => ({
                id: p.id,
                display_phone_number: p.display_phone_number,
              })) || [],
            });

            if (phoneData.data && phoneData.data.length > 0 && phoneData.data[0].id && wabaId) {
              const foundPhoneNumberId = phoneData.data[0].id;
              phoneNumberId = foundPhoneNumberId;
              debugInfo.phoneNumbers.push({
                wabaId,
                phoneNumberId: foundPhoneNumberId,
                display_phone_number: phoneData.data[0].display_phone_number,
              });
              console.log(`✅ [WhatsApp Simple Callback] Número encontrado: ${foundPhoneNumberId} no WABA ${wabaId}`);
              break; // Parar quando encontrar um número
            }
          } catch (phoneError) {
            console.warn(`⚠️ [WhatsApp Simple Callback] Erro ao buscar números do WABA ${wabaId}:`, phoneError);
            continue; // Tentar próximo WABA
          }
        }
      }

      // Método 2: Se não encontrou, tentar /me/businesses e depois buscar WABAs dentro de cada business
      if (!phoneNumberId) {
        console.log("📋 [WhatsApp Simple Callback] Tentando método alternativo: /me/businesses...");
        const businessesUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`;
        const businessesResponse = await fetch(businessesUrl);
        const businessesData = await businessesResponse.json();

        console.log("📋 [WhatsApp Simple Callback] Businesses Response:", {
          ok: businessesResponse.ok,
          status: businessesResponse.status,
          dataCount: businessesData.data?.length || 0,
          error: businessesData.error,
          fullResponse: businessesData,
        });

        if (businessesData.data && businessesData.data.length > 0) {
          for (const business of businessesData.data) {
            const businessId = business.id;
            console.log(`📋 [WhatsApp Simple Callback] Buscando WABAs dentro do business ${businessId}...`);
            
            try {
              // Buscar WABAs dentro deste business
              const businessWabaUrl = `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
              const businessWabaResponse = await fetch(businessWabaUrl);
              const businessWabaData = await businessWabaResponse.json();

              console.log(`📋 [WhatsApp Simple Callback] WABAs do business ${businessId}:`, {
                ok: businessWabaResponse.ok,
                status: businessWabaResponse.status,
                count: businessWabaData.data?.length || 0,
                error: businessWabaData.error,
                fullResponse: businessWabaData,
              });

              if (businessWabaData.data && businessWabaData.data.length > 0) {
                // Tentar cada WABA deste business
                for (const waba of businessWabaData.data) {
                  wabaId = waba.id;
                  console.log(`📞 [WhatsApp Simple Callback] Buscando números para WABA ${wabaId}...`);
                  
                  try {
                    const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
                    const phoneResponse = await fetch(phoneUrl);
                    const phoneData = await phoneResponse.json();

                    console.log(`📞 [WhatsApp Simple Callback] Phone Numbers para WABA ${wabaId}:`, {
                      ok: phoneResponse.ok,
                      status: phoneResponse.status,
                      count: phoneData.data?.length || 0,
                      error: phoneData.error,
                      fullResponse: phoneData,
                    });

                    if (phoneData.data && phoneData.data.length > 0 && phoneData.data[0].id && wabaId) {
                      const foundPhoneNumberId = phoneData.data[0].id;
                      phoneNumberId = foundPhoneNumberId;
                      debugInfo.phoneNumbers.push({
                        wabaId,
                        phoneNumberId: foundPhoneNumberId,
                        display_phone_number: phoneData.data[0].display_phone_number,
                      });
                      console.log(`✅ [WhatsApp Simple Callback] Número encontrado via /me/businesses: ${foundPhoneNumberId}`);
                      break;
                    }
                  } catch (phoneError) {
                    console.warn(`⚠️ [WhatsApp Simple Callback] Erro ao buscar números do WABA ${wabaId}:`, phoneError);
                    continue;
                  }
                }
                
                if (phoneNumberId) break; // Se encontrou, parar de buscar em outros businesses
              }
            } catch (businessError) {
              console.warn(`⚠️ [WhatsApp Simple Callback] Erro ao buscar WABAs do business ${businessId}:`, businessError);
              continue;
            }
          }
        }
      }

      // Método alternativo 2: Tentar buscar números de teste através do app_id
      if (!phoneNumberId && appId) {
        console.log("📋 [WhatsApp Simple Callback] Tentando método alternativo: buscar números de teste via app_id...");
        try {
          const testNumbersUrl = `https://graph.facebook.com/v21.0/${appId}/phone_numbers?access_token=${accessToken}`;
          const testNumbersResponse = await fetch(testNumbersUrl);
          const testNumbersData = await testNumbersResponse.json();

          console.log("📋 [WhatsApp Simple Callback] Test Numbers Response (via app_id):", {
            ok: testNumbersResponse.ok,
            status: testNumbersResponse.status,
            dataCount: testNumbersData.data?.length || 0,
            error: testNumbersData.error,
            fullResponse: testNumbersData,
            numbers: testNumbersData.data?.map((n: { id: string; verified_name?: string; display_phone_number?: string }) => ({
              id: n.id,
              verified_name: n.verified_name,
              display_phone_number: n.display_phone_number,
            })) || [],
          });

          if (testNumbersData.data && testNumbersData.data.length > 0 && testNumbersData.data[0].id) {
            phoneNumberId = testNumbersData.data[0].id;
            // Para números de teste, não temos WABA ID, mas podemos tentar descobrir
            console.log(`✅ [WhatsApp Simple Callback] Número de teste encontrado via app_id: ${phoneNumberId}`);
          }
        } catch (appError) {
          console.warn("⚠️ [WhatsApp Simple Callback] Erro ao buscar números via app_id:", appError);
        }
      }

      // Método alternativo 3: Tentar /me/owned_whatsapp_business_accounts (pode não existir)
      if (!phoneNumberId) {
        console.log("📋 [WhatsApp Simple Callback] Tentando método alternativo: /me/owned_whatsapp_business_accounts...");
        const ownedWabaUrl = `https://graph.facebook.com/v21.0/me/owned_whatsapp_business_accounts?access_token=${accessToken}`;
        const ownedWabaResponse = await fetch(ownedWabaUrl);
        const ownedWabaData = await ownedWabaResponse.json();

        console.log("📋 [WhatsApp Simple Callback] Owned WABA Response:", {
          ok: ownedWabaResponse.ok,
          status: ownedWabaResponse.status,
          dataCount: ownedWabaData.data?.length || 0,
          error: ownedWabaData.error,
          fullResponse: ownedWabaData,
        });

        if (ownedWabaData.data && ownedWabaData.data.length > 0) {
          wabaId = ownedWabaData.data[0].id;
          const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
          const phoneResponse = await fetch(phoneUrl);
          const phoneData = await phoneResponse.json();

          console.log(`📞 [WhatsApp Simple Callback] Phone Numbers (owned) para WABA ${wabaId}:`, {
            ok: phoneResponse.ok,
            status: phoneResponse.status,
            count: phoneData.data?.length || 0,
            error: phoneData.error,
            fullResponse: phoneData,
          });

          if (phoneData.data && phoneData.data.length > 0 && phoneData.data[0].id && wabaId) {
            const foundPhoneNumberId = phoneData.data[0].id;
            phoneNumberId = foundPhoneNumberId;
            debugInfo.phoneNumbers.push({
              wabaId,
              phoneNumberId: foundPhoneNumberId,
              display_phone_number: phoneData.data[0].display_phone_number,
            });
            console.log(`✅ [WhatsApp Simple Callback] Número encontrado via owned_whatsapp_business_accounts: ${foundPhoneNumberId}`);
          }
        }
      }
    } catch (error) {
      console.error("❌ [WhatsApp Simple Callback] Erro ao buscar número:", error);
    }

    console.log("📊 [WhatsApp Simple Callback] Resumo final:", {
      phoneNumberId,
      wabaId,
      hasAccessToken: !!accessToken,
      debugInfo,
    });

    // Inscrever app no WABA para receber webhooks
    if (wabaId && accessToken) {
      try {
        const subscribeUrl = `https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`;
        await fetch(subscribeUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (err) {
        console.warn("⚠️ [WhatsApp Simple Callback] Erro ao inscrever app:", err);
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
        console.log("✅ [WhatsApp Simple Callback] Número registrado com PIN");
      } catch (err) {
        console.warn("⚠️ [WhatsApp Simple Callback] Erro ao registrar número:", err);
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
      console.error("❌ [WhatsApp Simple Callback] Erro ao salvar:", upsertError);
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=save_failed&debug=${encodeURIComponent(JSON.stringify({ error: upsertError.message }))}`, request.url)
      );
    }

    // Preparar informações de debug para o cliente (sem dados sensíveis)
    const clientDebugInfo = {
      phoneNumberId: phoneNumberId || null,
      wabaId: wabaId || null,
      phoneNumberStatus: phoneNumberId ? "found" : "not_found",
      wabaMethod1Found: debugInfo.wabaMethod1 ? debugInfo.wabaMethod1.dataCount > 0 : false,
      wabaMethod1Error: debugInfo.wabaMethod1?.error
        ? (typeof debugInfo.wabaMethod1.error === "object" && debugInfo.wabaMethod1.error !== null && "message" in debugInfo.wabaMethod1.error
          ? (debugInfo.wabaMethod1.error as { message?: string }).message
          : String(debugInfo.wabaMethod1.error))
        : null,
      wabaMethod1Status: debugInfo.wabaMethod1?.status || null,
      phoneNumbersCount: debugInfo.phoneNumbers.length,
      suggestion: !phoneNumberId 
        ? "Número não encontrado automaticamente. Verifique se você tem um número de teste configurado no app da Meta ou se o número real está registrado no Business Manager. Você pode configurar manualmente o Phone Number ID nas configurações."
        : null,
    };

    console.log("✅ [WhatsApp Simple Callback] Integração salva com sucesso:", {
      clinicId: stateData.clinicId,
      status: integrationStatus,
      ...clientDebugInfo,
    });

    // Redirecionar para página de configurações com sucesso e debug info
    const redirectUrl = new URL("/dashboard/configuracoes", request.url);
    redirectUrl.searchParams.set("integration", "whatsapp_simple");
    redirectUrl.searchParams.set("status", integrationStatus);
    redirectUrl.searchParams.set("debug", encodeURIComponent(JSON.stringify(clientDebugInfo)));
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Erro no callback OAuth Meta (simples):", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
