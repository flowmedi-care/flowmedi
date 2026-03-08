import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

type IntegrationRow = {
  id: string;
  credentials: { access_token?: string } | null;
  metadata: Record<string, unknown> | null;
};

function buildMetaBillingUrl(wabaId: string | null): string {
  if (!wabaId) {
    return "https://business.facebook.com/settings/whatsapp-business-accounts";
  }
  return `https://business.facebook.com/latest/whatsapp_manager/waba/?waba_id=${encodeURIComponent(
    wabaId
  )}`;
}

function extractBillingStatus(payload: Record<string, unknown> | null): {
  status: "configured" | "pending" | "unknown";
  hasPaymentMethod: boolean | null;
} {
  if (!payload || typeof payload !== "object") {
    return { status: "unknown", hasPaymentMethod: null };
  }

  const paymentConfiguration = payload.payment_configuration as Record<string, unknown> | undefined;
  if (!paymentConfiguration || typeof paymentConfiguration !== "object") {
    return { status: "pending", hasPaymentMethod: false };
  }

  const keysThatUsuallyIndicatePayment = [
    "payment_method",
    "payment_methods",
    "funding_source",
    "credit_line",
    "billing_setup",
    "billing_account_id",
  ];

  const hasPaymentMethod = keysThatUsuallyIndicatePayment.some((k) => {
    const value = paymentConfiguration[k];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return value !== null && value !== undefined && String(value).trim() !== "";
  });

  return {
    status: hasPaymentMethod ? "configured" : "pending",
    hasPaymentMethod,
  };
}

export async function GET() {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();

    const { data: integration, error } = await supabase
      .from("clinic_integrations")
      .select("id, credentials, metadata")
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "whatsapp_meta")
      .eq("status", "connected")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!integration) {
      return NextResponse.json({ error: "Integração WhatsApp Meta não conectada." }, { status: 404 });
    }

    const row = integration as IntegrationRow;
    const token = row.credentials?.access_token;
    const wabaId = typeof row.metadata?.waba_id === "string" ? row.metadata.waba_id : null;
    const manageUrl = buildMetaBillingUrl(wabaId);

    if (!token || !wabaId) {
      return NextResponse.json({
        status: "unknown",
        hasPaymentMethod: null,
        manageUrl,
        message: "Não foi possível verificar a cobrança automaticamente.",
      });
    }

    const graphRes = await fetch(
      `https://graph.facebook.com/v23.0/${wabaId}?fields=id,name,currency,payment_configuration`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const graphData = (await graphRes.json()) as Record<string, unknown>;

    let status: "configured" | "pending" | "unknown" = "unknown";
    let hasPaymentMethod: boolean | null = null;

    if (graphRes.ok) {
      const extracted = extractBillingStatus(graphData);
      status = extracted.status;
      hasPaymentMethod = extracted.hasPaymentMethod;
    }

    const mergedMetadata = {
      ...(row.metadata ?? {}),
      whatsapp_billing_status: status,
      whatsapp_billing_has_payment_method: hasPaymentMethod,
      whatsapp_billing_last_checked_at: new Date().toISOString(),
      whatsapp_billing_manage_url: manageUrl,
      whatsapp_billing_last_error: graphRes.ok
        ? null
        : ((graphData?.error as { message?: string } | undefined)?.message ?? "Falha ao consultar cobrança"),
    };

    await supabase
      .from("clinic_integrations")
      .update({
        metadata: mergedMetadata,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return NextResponse.json({
      status,
      hasPaymentMethod,
      manageUrl,
      message:
        status === "configured"
          ? "Forma de pagamento identificada na Meta."
          : status === "pending"
            ? "Cadastro concluído, mas ainda sem forma de pagamento na Meta."
            : "Não foi possível confirmar a forma de pagamento automaticamente.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao verificar cobrança Meta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
