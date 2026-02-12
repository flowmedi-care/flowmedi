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

    console.log("🔑 [WhatsApp Callback] Token Response:", {
      ok: tokenResponse.ok,
      status: tokenResponse.status,
      hasToken: !!tokenData.access_token,
      error: tokenData.error,
      expiresIn: tokenData.expires_in,
    });

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("❌ [WhatsApp Callback] Erro ao obter token:", tokenData);
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=token_failed&debug=${encodeURIComponent(JSON.stringify({ error: tokenData.error }))}`, request.url)
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || null;

    // Obter informações do usuário/perfil
    const userInfoUrl = `https://graph.facebook.com/v21.0/me?access_token=${accessToken}&fields=id,name`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();
    
    console.log("👤 [WhatsApp Callback] User Info:", {
      id: userInfo.id,
      name: userInfo.name,
      error: userInfo.error,
    });

    // Tentar obter informações do WhatsApp Business Account (WABA)
    // Nota: Isso pode requerer permissões adicionais e configuração no Meta Business Manager
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;

    const debugInfo: {
      wabaMethod1: {
        ok: boolean;
        status: number;
        dataCount: number;
        error?: unknown;
        businesses: Array<{ id: string; name: string }>;
      } | null;
      wabaMethod2: {
        ok: boolean;
        status: number;
        dataCount: number;
        error?: unknown;
        accounts: Array<{ id: string; name?: string }>;
      } | null;
      phoneNumbers: Array<{
        wabaId: string;
        phoneNumberId: string;
        verified_name?: string;
        display_phone_number?: string;
      }>;
    } = {
      wabaMethod1: null,
      wabaMethod2: null,
      phoneNumbers: [],
    };

    try {
      // Método 1: Buscar WABAs através de /me/businesses
      const wabaUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`;
      const wabaResponse = await fetch(wabaUrl);
      const wabaData = await wabaResponse.json();
      
      console.log("📋 [WhatsApp Callback] WABA Method 1 (/me/businesses):", {
        ok: wabaResponse.ok,
        status: wabaResponse.status,
        dataCount: wabaData.data?.length || 0,
        error: wabaData.error,
        businesses: wabaData.data?.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })) || [],
      });
      
      debugInfo.wabaMethod1 = {
        ok: wabaResponse.ok,
        status: wabaResponse.status,
        dataCount: wabaData.data?.length || 0,
        error: wabaData.error,
        businesses: wabaData.data?.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })) || [],
      };
      
      if (wabaData.data && wabaData.data.length > 0) {
        // Tentar todos os WABAs até encontrar um número
        for (const business of wabaData.data) {
          wabaId = business.id;
          try {
            // Buscar números de telefone do WABA
            const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();
            
            console.log(`📞 [WhatsApp Callback] Phone Numbers para WABA ${wabaId}:`, {
              ok: phoneResponse.ok,
              status: phoneResponse.status,
              count: phoneData.data?.length || 0,
              error: phoneData.error,
              numbers: phoneData.data?.map((p: { id: string; verified_name?: string; display_phone_number?: string }) => ({
                id: p.id,
                verified_name: p.verified_name,
                display_phone_number: p.display_phone_number,
              })) || [],
            });
            
            if (phoneData.data && phoneData.data.length > 0 && wabaId) {
              // Pegar o primeiro número disponível (pode ser teste ou real)
              phoneNumberId = phoneData.data[0].id;
              debugInfo.phoneNumbers.push({
                wabaId,
                phoneNumberId,
                verified_name: phoneData.data[0].verified_name,
                display_phone_number: phoneData.data[0].display_phone_number,
              });
              console.log(`✅ [WhatsApp Callback] Número encontrado: ${phoneNumberId} no WABA ${wabaId}`);
              break; // Parar quando encontrar um número
            }
          } catch (phoneError) {
            console.warn(`⚠️ [WhatsApp Callback] Erro ao buscar números do WABA ${wabaId}:`, phoneError);
            continue; // Tentar próximo WABA
          }
        }
      }

      // Método 2: Se não encontrou, tentar buscar através de /me/owned_whatsapp_business_accounts
      if (!phoneNumberId) {
        try {
          const ownedWabaUrl = `https://graph.facebook.com/v21.0/me/owned_whatsapp_business_accounts?access_token=${accessToken}`;
          const ownedWabaResponse = await fetch(ownedWabaUrl);
          const ownedWabaData = await ownedWabaResponse.json();
          
          console.log("📋 [WhatsApp Callback] WABA Method 2 (/me/owned_whatsapp_business_accounts):", {
            ok: ownedWabaResponse.ok,
            status: ownedWabaResponse.status,
            dataCount: ownedWabaData.data?.length || 0,
            error: ownedWabaData.error,
            accounts: ownedWabaData.data?.map((a: { id: string; name?: string }) => ({ id: a.id, name: a.name })) || [],
          });
          
          debugInfo.wabaMethod2 = {
            ok: ownedWabaResponse.ok,
            status: ownedWabaResponse.status,
            dataCount: ownedWabaData.data?.length || 0,
            error: ownedWabaData.error,
            accounts: ownedWabaData.data?.map((a: { id: string; name?: string }) => ({ id: a.id, name: a.name })) || [],
          };
          
          if (ownedWabaData.data && ownedWabaData.data.length > 0) {
            wabaId = ownedWabaData.data[0].id;
            const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();
            
            console.log(`📞 [WhatsApp Callback] Phone Numbers (Method 2) para WABA ${wabaId}:`, {
              ok: phoneResponse.ok,
              status: phoneResponse.status,
              count: phoneData.data?.length || 0,
              error: phoneData.error,
              numbers: phoneData.data?.map((p: { id: string; verified_name?: string; display_phone_number?: string }) => ({
                id: p.id,
                verified_name: p.verified_name,
                display_phone_number: p.display_phone_number,
              })) || [],
            });
            
            if (phoneData.data && phoneData.data.length > 0 && wabaId) {
              phoneNumberId = phoneData.data[0].id;
              debugInfo.phoneNumbers.push({
                wabaId,
                phoneNumberId,
                verified_name: phoneData.data[0].verified_name,
                display_phone_number: phoneData.data[0].display_phone_number,
              });
              console.log(`✅ [WhatsApp Callback] Número encontrado via owned_whatsapp_business_accounts: ${phoneNumberId}`);
            }
          }
        } catch (ownedError) {
          console.warn("⚠️ [WhatsApp Callback] Erro ao buscar via owned_whatsapp_business_accounts:", ownedError);
        }
      }
    } catch (error) {
      console.warn("⚠️ [WhatsApp Callback] Não foi possível obter informações do WABA:", error);
      // Continuar mesmo sem WABA - o usuário pode configurar depois
    }
    
    console.log("📊 [WhatsApp Callback] Resumo final:", {
      phoneNumberId,
      wabaId,
      hasAccessToken: !!accessToken,
      debugInfo,
    });

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

    // Se o OAuth funcionou (tem access_token), marcar como connected
    // O número pode estar pendente na Meta, mas a integração está conectada
    // O phoneNumberId pode ser encontrado depois ou configurado manualmente
    const integrationStatus = accessToken ? "connected" : "pending";

    const { error: upsertError } = await supabase
      .from("clinic_integrations")
      .upsert(
        {
          clinic_id: stateData.clinicId,
          integration_type: "whatsapp_meta",
          status: integrationStatus,
          credentials: credentials,
          metadata: {
            ...metadata,
            phone_number_id: phoneNumberId || null, // Salvar mesmo se null para debug
            waba_id: wabaId || null,
            phone_number_status: phoneNumberId ? "found" : "not_found", // Para debug
          },
          connected_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
        },
        {
          onConflict: "clinic_id,integration_type",
        }
      );

    if (upsertError) {
      console.error("❌ [WhatsApp Callback] Erro ao salvar integração:", upsertError);
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
      wabaMethod2Found: debugInfo.wabaMethod2 ? debugInfo.wabaMethod2.dataCount > 0 : false,
      phoneNumbersCount: debugInfo.phoneNumbers.length,
    };

    console.log("✅ [WhatsApp Callback] Integração salva com sucesso:", {
      clinicId: stateData.clinicId,
      status: integrationStatus,
      ...clientDebugInfo,
    });

    // Redirecionar para página de configurações com sucesso e debug info
    const redirectUrl = new URL("/dashboard/configuracoes", request.url);
    redirectUrl.searchParams.set("integration", "whatsapp");
    redirectUrl.searchParams.set("status", integrationStatus);
    redirectUrl.searchParams.set("debug", encodeURIComponent(JSON.stringify(clientDebugInfo)));
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Erro no callback OAuth Meta:", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
