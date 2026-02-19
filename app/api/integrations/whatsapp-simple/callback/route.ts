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

    // Trocar código por access token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("❌ [WhatsApp Simple Callback] Erro ao obter token:", tokenData);
      return NextResponse.redirect(
        new URL(`/dashboard/configuracoes?error=token_failed`, request.url)
      );
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || null;

    // Buscar phone_number_id e WABA
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;

    try {
      // Método 1: Buscar WABAs através de /me/businesses
      const wabaUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}`;
      const wabaResponse = await fetch(wabaUrl);
      const wabaData = await wabaResponse.json();

      if (wabaData.data && wabaData.data.length > 0) {
        wabaId = wabaData.data[0].id;
        const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
        const phoneResponse = await fetch(phoneUrl);
        const phoneData = await phoneResponse.json();

        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
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
    } catch (error) {
      console.warn("⚠️ [WhatsApp Simple Callback] Erro ao buscar número:", error);
    }

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

    const metadata: Record<string, unknown> = {};
    if (phoneNumberId) metadata.phone_number_id = phoneNumberId;
    if (wabaId) metadata.waba_id = wabaId;

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
        new URL("/dashboard/configuracoes?error=save_failed", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?integration=whatsapp_simple&status=connected", request.url)
    );
  } catch (error) {
    console.error("Erro no callback OAuth Meta (simples):", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?error=callback_failed", request.url)
    );
  }
}
