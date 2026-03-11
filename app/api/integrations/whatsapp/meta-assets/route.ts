import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { assertWhatsAppFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";

type IntegrationRow = {
  integration_type: "whatsapp_simple" | "whatsapp_meta";
  credentials: { access_token?: string } | null;
  metadata: { waba_id?: string; phone_number_id?: string } | null;
};

type MetaBusiness = {
  id: string;
  name: string;
  verification_status?: string;
  wabas: Array<{
    id: string;
    name: string;
    phone_numbers: Array<{
      id: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      code_verification_status?: string;
      status?: string;
    }>;
  }>;
};

export async function GET() {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();
    const whatsappAccess = await assertWhatsAppFeatureAccessForCurrentClinic();
    if (!whatsappAccess.allowed) {
      return NextResponse.json({ error: whatsappAccess.error }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from("clinic_integrations")
      .select("integration_type, credentials, metadata")
      .eq("clinic_id", admin.clinicId)
      .in("integration_type", ["whatsapp_simple", "whatsapp_meta"])
      .eq("status", "connected");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const typedRows = (rows ?? []) as IntegrationRow[];
    const chosen =
      typedRows.find((r) => r.integration_type === "whatsapp_simple") ??
      typedRows.find((r) => r.integration_type === "whatsapp_meta");

    if (!chosen?.credentials?.access_token) {
      return NextResponse.json(
        { error: "Integração WhatsApp conectada não encontrada." },
        { status: 404 }
      );
    }

    const token = chosen.credentials.access_token;
    const bearer = { Authorization: `Bearer ${token}` };

    const businessesRes = await fetch(
      "https://graph.facebook.com/v23.0/me/businesses?fields=id,name,verification_status",
      { headers: bearer }
    );
    const businessesData = await businessesRes.json();

    if (!businessesRes.ok) {
      return NextResponse.json(
        { error: businessesData?.error?.message || "Erro ao listar businesses da Meta." },
        { status: 400 }
      );
    }

    const businesses: MetaBusiness[] = [];
    for (const business of businessesData.data ?? []) {
      const bId = String(business.id);
      const wabaRes = await fetch(
        `https://graph.facebook.com/v23.0/${bId}/owned_whatsapp_business_accounts?fields=id,name`,
        { headers: bearer }
      );
      const wabaData = await wabaRes.json();
      const wabas: MetaBusiness["wabas"] = [];

      if (wabaRes.ok) {
        for (const waba of wabaData.data ?? []) {
          const wId = String(waba.id);
          const phonesRes = await fetch(
            `https://graph.facebook.com/v23.0/${wId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,status`,
            { headers: bearer }
          );
          const phonesData = await phonesRes.json();
          wabas.push({
            id: wId,
            name: String(waba.name ?? ""),
            phone_numbers: phonesRes.ok
              ? (phonesData.data ?? []).map((p: Record<string, unknown>) => ({
                  id: String(p.id ?? ""),
                  display_phone_number:
                    typeof p.display_phone_number === "string" ? p.display_phone_number : undefined,
                  verified_name: typeof p.verified_name === "string" ? p.verified_name : undefined,
                  quality_rating: typeof p.quality_rating === "string" ? p.quality_rating : undefined,
                  code_verification_status:
                    typeof p.code_verification_status === "string" ? p.code_verification_status : undefined,
                  status: typeof p.status === "string" ? p.status : undefined,
                }))
              : [],
          });
        }
      }

      businesses.push({
        id: bId,
        name: String(business.name ?? ""),
        verification_status:
          typeof business.verification_status === "string" ? business.verification_status : undefined,
        wabas,
      });
    }

    return NextResponse.json({
      integration_type: chosen.integration_type,
      selected_waba_id: chosen.metadata?.waba_id ?? null,
      selected_phone_number_id: chosen.metadata?.phone_number_id ?? null,
      businesses,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar ativos Meta." },
      { status: 500 }
    );
  }
}

