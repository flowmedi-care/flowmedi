import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Tenta descobrir o Phone Number ID automaticamente via API da Meta
 * usando o token salvo na integração.
 * POST /api/integrations/whatsapp-simple/discover-phone-id
 */
export async function POST() {
  try {
    const admin = await requireClinicAdmin();

    const supabase = await createClient();

    const { data: integration, error: fetchError } = await supabase
      .from("clinic_integrations")
      .select("credentials, metadata")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple")
      .eq("status", "connected")
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integração WhatsApp Simple não encontrada ou não conectada." },
        { status: 404 }
      );
    }

    const accessToken = (integration.credentials as { access_token?: string })?.access_token;
    console.log("[WhatsApp OAuth] Discover: token obtido?", !!accessToken, "clinicId:", admin.clinicId);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Token de acesso não encontrado. Reconecte o WhatsApp." },
        { status: 400 }
      );
    }

    const appId = process.env.META_APP_ID;
    let phoneNumberId: string | null = null;
    let wabaId: string | null = null;

    const bearer = { Authorization: `Bearer ${accessToken}` };

    // PASSO 1: me/businesses → BUSINESS_ID
    // PASSO 2: BUSINESS_ID/owned_whatsapp_business_accounts → WABA_ID
    // PASSO 3: WABA_ID/phone_numbers → PHONE_NUMBER_ID
    try {
      const businessesRes = await fetch(
        "https://graph.facebook.com/v19.0/me/businesses",
        { headers: bearer }
      );
      const businessesData = await businessesRes.json();
      console.log("[WhatsApp OAuth] Discover PASSO 1 me/businesses:", {
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
          console.log("[WhatsApp OAuth] Discover PASSO 2 business", business.id, "owned_whatsapp_business_accounts:", {
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
            console.log("[WhatsApp OAuth] Discover PASSO 3 WABA", wabaId, "phone_numbers:", {
              status: phoneRes.status,
              count: phoneData.data?.length ?? 0,
              phones: phoneData.data?.map((p: { id: string; display_phone_number?: string }) => ({ id: p.id, display: p.display_phone_number })) ?? [],
              error: phoneData.error?.message ?? null,
            });
            if (phoneData.data?.length) {
              phoneNumberId = phoneData.data[0].id;
              console.log("[WhatsApp OAuth] Discover: ✅ encontrado via me/businesses → owned_whatsapp_business_accounts → phone_numbers");
              break;
            }
          }
        }
      }
    } catch (e) {
      console.log("[WhatsApp OAuth] Discover: erro fluxo businesses:", e);
    }

    // Fallback: /me/accounts (Pages/contas)
    if (!phoneNumberId) {
      try {
        const accountsRes = await fetch(
          "https://graph.facebook.com/v19.0/me/accounts",
          { headers: bearer }
        );
        const accountsData = await accountsRes.json();
        console.log("[WhatsApp OAuth] Discover: me/accounts", {
          status: accountsRes.status,
          count: accountsData.data?.length ?? 0,
          error: accountsData.error?.message ?? null,
        });
        if (accountsData.data?.length) {
          for (const account of accountsData.data) {
            const phoneRes = await fetch(
              `https://graph.facebook.com/v19.0/${account.id}/phone_numbers`,
              { headers: bearer }
            );
            const phoneData = await phoneRes.json();
            if (phoneData.data?.length) {
              phoneNumberId = phoneData.data[0].id;
              wabaId = account.id;
              break;
            }
          }
        }
      } catch {
        // continuar
      }
    }

    if (!phoneNumberId) {
      console.log("[WhatsApp OAuth] Discover: nenhum phone_number_id encontrado após todos os métodos");
      return NextResponse.json(
        { error: "Não foi possível encontrar o Phone Number ID automaticamente. Cole manualmente abaixo." },
        { status: 404 }
      );
    }

    console.log("[WhatsApp OAuth] Discover: phone_number_id encontrado:", phoneNumberId);

    const currentMetadata = (integration.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...currentMetadata,
      phone_number_id: phoneNumberId,
      ...(wabaId ? { waba_id: wabaId } : {}),
    };

    const { error: updateError } = await supabase
      .from("clinic_integrations")
      .update({
        metadata: updatedMetadata,
        last_sync_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_simple");

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, phone_number_id: phoneNumberId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao descobrir número" },
      { status: 500 }
    );
  }
}
