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

    // 1️⃣ Fluxo SIMPLES: app_id/phone_numbers (números do app, sem Business Manager)
    if (appId && !phoneNumberId) {
      try {
        const appRes = await fetch(
          `https://graph.facebook.com/v21.0/${appId}/phone_numbers`,
          { headers: bearer }
        );
        const appData = await appRes.json();
        console.log("[WhatsApp OAuth] Discover: app_id/phone_numbers (fluxo simples)", {
          status: appRes.status,
          count: appData.data?.length ?? 0,
          error: appData.error?.message ?? null,
        });
        if (appData.data?.length) {
          phoneNumberId = appData.data[0].id;
          wabaId = appData.data[0].waba_id ?? null;
          console.log("[WhatsApp OAuth] Discover: ✅ encontrado via app_id/phone_numbers (fluxo simples)");
        }
      } catch (e) {
        console.log("[WhatsApp OAuth] Discover: erro app_id/phone_numbers:", e);
      }
    }

    // 2️⃣ Fluxo NORMAL: /me/owned_whatsapp_business_accounts (WABAs do usuário)
    if (!phoneNumberId) {
      try {
        const ownedRes = await fetch(
          "https://graph.facebook.com/v21.0/me/owned_whatsapp_business_accounts",
          { headers: bearer }
        );
        const ownedData = await ownedRes.json();
        console.log("[WhatsApp OAuth] Discover: me/owned_whatsapp_business_accounts", {
          status: ownedRes.status,
          count: ownedData.data?.length ?? 0,
          error: ownedData.error?.message ?? null,
        });
        if (ownedData.data?.length) {
          wabaId = ownedData.data[0].id;
          const phoneRes = await fetch(
            `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
            { headers: bearer }
          );
          const phoneData = await phoneRes.json();
          if (phoneData.data?.length) {
            phoneNumberId = phoneData.data[0].id;
            console.log("[WhatsApp OAuth] Discover: ✅ encontrado via owned_whatsapp_business_accounts");
          }
        }
      } catch (e) {
        console.log("[WhatsApp OAuth] Discover: erro owned_whatsapp_business_accounts:", e);
      }
    }

    // 3️⃣ Fluxo Business: me/businesses → client_whatsapp_business_accounts
    if (!phoneNumberId) {
      try {
        const businessesRes = await fetch(
          "https://graph.facebook.com/v21.0/me/businesses",
          { headers: bearer }
        );
        const businessesData = await businessesRes.json();
        console.log("[WhatsApp OAuth] Discover: me/businesses", {
          status: businessesRes.status,
          count: businessesData.data?.length ?? 0,
          error: businessesData.error?.message ?? null,
        });
        if (businessesData.data?.length) {
          for (const business of businessesData.data) {
            const wabaRes = await fetch(
              `https://graph.facebook.com/v21.0/${business.id}/client_whatsapp_business_accounts`,
              { headers: bearer }
            );
            const wabaData = await wabaRes.json();
            if (wabaData.data?.length) {
              wabaId = wabaData.data[0].id;
              const phoneRes = await fetch(
                `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
                { headers: bearer }
              );
              const phoneData = await phoneRes.json();
              if (phoneData.data?.length) {
                phoneNumberId = phoneData.data[0].id;
                console.log("[WhatsApp OAuth] Discover: ✅ encontrado via businesses → client_whatsapp_business_accounts");
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log("[WhatsApp OAuth] Discover: erro businesses:", e);
      }
    }

    // 4️⃣ Fallback: /me/accounts (Pages/contas)
    if (!phoneNumberId) {
      try {
        const accountsRes = await fetch(
          "https://graph.facebook.com/v21.0/me/accounts",
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
              `https://graph.facebook.com/v21.0/${account.id}/phone_numbers`,
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
