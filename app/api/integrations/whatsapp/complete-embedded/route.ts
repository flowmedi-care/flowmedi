import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";

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
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }

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
    console.info("[WA_EMBEDDED] complete:start", {
      clinicId: admin.clinicId,
      sessionEvent: pickString(body.sessionInfo?.event),
      hasSessionWabaId: Boolean(wabaId),
      hasSessionPhoneNumberId: Boolean(phoneNumberId),
    });

    // Fallback 1: endpoint direto de WhatsApp (não depende de business_management).
    if (!wabaId || !phoneNumberId) {
      const waAccountsRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number}`,
        { headers: bearer }
      );
      const waAccountsData = (await waAccountsRes.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          phone_numbers?: Array<{ id: string; display_phone_number?: string }>;
        }>;
      };

      if (waAccountsRes.ok && waAccountsData.data?.length) {
        const waCandidates = waAccountsData.data.map((account) => ({
          wabaId: account.id,
          phoneIds: (account.phone_numbers ?? [])
            .map((phone) => pickString(phone.id))
            .filter((phone): phone is string => Boolean(phone)),
        }));

        if (!wabaId && phoneNumberId) {
          const byPhone = waCandidates.find((candidate) =>
            candidate.phoneIds.includes(phoneNumberId as string)
          );
          if (byPhone) wabaId = byPhone.wabaId;
        }

        if (wabaId && !phoneNumberId) {
          const byWaba = waCandidates.find((candidate) => candidate.wabaId === wabaId);
          if (byWaba?.phoneIds.length) {
            phoneNumberId = byWaba.phoneIds[0];
          }
        }

        if (!wabaId || !phoneNumberId) {
          const withPhones = waCandidates.filter((candidate) => candidate.phoneIds.length > 0);
          if (withPhones.length === 1) {
            wabaId = wabaId || withPhones[0].wabaId;
            phoneNumberId = phoneNumberId || withPhones[0].phoneIds[0] || null;
          }
        }

        console.info("[WA_EMBEDDED] complete:wa-accounts-fallback", {
          clinicId: admin.clinicId,
          waAccountCount: waAccountsData.data.length,
          resolvedWabaId: wabaId,
          resolvedPhoneNumberId: phoneNumberId,
        });
      }
    }

    // Fallback 2: descobrir WABA e número via businesses quando necessário.
    // Importante: evitar "pegar o primeiro" quando existem múltiplas contas/números.
    if (!wabaId || !phoneNumberId) {
      const businessesRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/me/businesses?fields=id,name`,
        { headers: bearer }
      );
      const businessesData = (await businessesRes.json()) as {
        data?: Array<{ id: string; name?: string }>;
      };

      if (businessesRes.ok && businessesData.data?.length) {
        type WabaCandidate = {
          wabaId: string;
          phoneIds: string[];
        };
        const candidates: WabaCandidate[] = [];

        for (const business of businessesData.data) {
          const ownedWabaRes = await fetch(
            `https://graph.facebook.com/${graphVersion}/${business.id}/owned_whatsapp_business_accounts?fields=id,name`,
            { headers: bearer }
          );
          const ownedWabaData = (await ownedWabaRes.json()) as {
            data?: Array<{ id: string; name?: string }>;
          };

          if (!ownedWabaRes.ok || !ownedWabaData.data?.length) {
            continue;
          }

          for (const waba of ownedWabaData.data) {
            const selectedWabaId = waba.id;
            const phonesRes = await fetch(
              `https://graph.facebook.com/${graphVersion}/${selectedWabaId}/phone_numbers?fields=id,display_phone_number`,
              { headers: bearer }
            );
            const phonesData = (await phonesRes.json()) as {
              data?: Array<{ id: string; display_phone_number?: string }>;
            };
            const phoneIds = phonesRes.ok
              ? (phonesData.data ?? [])
                  .map((phone) => pickString(phone.id))
                  .filter((phone): phone is string => Boolean(phone))
              : [];
            candidates.push({
              wabaId: selectedWabaId,
              phoneIds,
            });
          }
        }

        if (!wabaId && phoneNumberId) {
          const byPhone = candidates.find((candidate) =>
            candidate.phoneIds.includes(phoneNumberId as string)
          );
          if (byPhone) {
            wabaId = byPhone.wabaId;
          }
        }

        if (wabaId && !phoneNumberId) {
          const byWaba = candidates.find((candidate) => candidate.wabaId === wabaId);
          if (byWaba?.phoneIds.length) {
            phoneNumberId = byWaba.phoneIds[0];
          }
        }

        if (!wabaId || !phoneNumberId) {
          const uniqueWabas = candidates.filter((candidate) => candidate.phoneIds.length > 0);
          if (uniqueWabas.length === 1) {
            wabaId = wabaId || uniqueWabas[0].wabaId;
            phoneNumberId = phoneNumberId || uniqueWabas[0].phoneIds[0] || null;
          } else if (uniqueWabas.length > 1) {
            console.warn("[WA_EMBEDDED] complete:ambiguous-fallback", {
              clinicId: admin.clinicId,
              candidates: uniqueWabas.map((candidate) => ({
                wabaId: candidate.wabaId,
                phoneCount: candidate.phoneIds.length,
              })),
            });
          }
        }

        console.info("[WA_EMBEDDED] complete:fallback-result", {
          clinicId: admin.clinicId,
          candidateCount: candidates.length,
          resolvedWabaId: wabaId,
          resolvedPhoneNumberId: phoneNumberId,
        });
      }
    }

    if (!wabaId || !phoneNumberId) {
      console.warn("[WA_EMBEDDED] complete:missing-target-after-fallback", {
        clinicId: admin.clinicId,
        hasWabaId: Boolean(wabaId),
        hasPhoneNumberId: Boolean(phoneNumberId),
      });
      return NextResponse.json(
        {
          error:
            "Nao foi possivel identificar automaticamente o WABA/numero da conta atual no cadastro incorporado. Desconecte, conecte novamente e finalize o fluxo no mesmo numero.",
        },
        { status: 409 }
      );
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

    console.info("[WA_EMBEDDED] complete:success", {
      clinicId: admin.clinicId,
      wabaId,
      phoneNumberId,
      embeddedEvent: pickString(body.sessionInfo?.event),
    });

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
