import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

type EmbeddedSignupSessionData = {
  event?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: { message?: string };
};

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();

    const body = (await request.json()) as {
      code?: string;
      sessionInfo?: EmbeddedSignupSessionData;
    };

    const code = pickString(body.code);
    if (!code) {
      return NextResponse.json({ error: "Código do Embedded Signup não informado." }, { status: 400 });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const graphVersion = process.env.META_GRAPH_VERSION || "v25.0";
    if (!appId || !appSecret) {
      return NextResponse.json({ error: "Meta App ID/App Secret não configurados." }, { status: 500 });
    }

    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = (await tokenResponse.json()) as TokenResponse;
    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: tokenData.error?.message || "Não foi possível trocar o código por token." },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;
    const bearer = { Authorization: `Bearer ${accessToken}` };

    const userInfoResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/me?fields=id,name`,
      { headers: bearer }
    );
    const userInfo = (await userInfoResponse.json()) as { id?: string; name?: string };

    let wabaId = pickString(body.sessionInfo?.data?.waba_id);
    let phoneNumberId = pickString(body.sessionInfo?.data?.phone_number_id);

    // Fallback: descobrir WABA e número automaticamente quando a sessão não trouxer IDs.
    if (!wabaId || !phoneNumberId) {
      const businessesRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/me/businesses?fields=id,name`,
        { headers: bearer }
      );
      const businessesData = (await businessesRes.json()) as {
        data?: Array<{ id: string; name?: string }>;
      };

      if (businessesRes.ok && businessesData.data?.length) {
        for (const business of businessesData.data) {
          const ownedWabaRes = await fetch(
            `https://graph.facebook.com/${graphVersion}/${business.id}/owned_whatsapp_business_accounts?fields=id,name`,
            { headers: bearer }
          );
          const ownedWabaData = (await ownedWabaRes.json()) as {
            data?: Array<{ id: string; name?: string }>;
          };

          if (!ownedWabaRes.ok || !ownedWabaData.data?.length) continue;

          const selectedWabaId = ownedWabaData.data[0].id;
          const phonesRes = await fetch(
            `https://graph.facebook.com/${graphVersion}/${selectedWabaId}/phone_numbers?fields=id,display_phone_number`,
            { headers: bearer }
          );
          const phonesData = (await phonesRes.json()) as {
            data?: Array<{ id: string; display_phone_number?: string }>;
          };

          if (phonesRes.ok && phonesData.data?.length) {
            wabaId = wabaId || selectedWabaId;
            phoneNumberId = phoneNumberId || phonesData.data[0].id;
            break;
          }
        }
      }
    }

    if (wabaId) {
      await fetch(`https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: bearer,
      });
    }

    const { error: upsertError } = await supabase.from("clinic_integrations").upsert(
      {
        clinic_id: admin.clinicId,
        integration_type: "whatsapp_meta",
        status: "connected",
        credentials: {
          access_token: accessToken,
          expires_in: tokenData.expires_in ?? null,
          token_type: tokenData.token_type || "bearer",
        },
        metadata: {
          user_id: pickString(userInfo.id),
          user_name: pickString(userInfo.name),
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          embedded_signup_event: pickString(body.sessionInfo?.event),
          whatsapp_billing_status: "pending",
          whatsapp_billing_has_payment_method: null,
          whatsapp_billing_last_checked_at: null,
          whatsapp_billing_manage_url: wabaId
            ? `https://business.facebook.com/latest/whatsapp_manager/waba/?waba_id=${encodeURIComponent(wabaId)}`
            : "https://business.facebook.com/settings/whatsapp-business-accounts",
          whatsapp_billing_last_error: null,
        },
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        error_message: null,
      },
      {
        onConflict: "clinic_id,integration_type",
      }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: "connected",
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao finalizar Embedded Signup." },
      { status: 500 }
    );
  }
}
