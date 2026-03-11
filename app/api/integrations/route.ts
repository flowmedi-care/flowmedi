import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";

/**
 * Lista integrações da clínica
 * GET /api/integrations
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();
    const planData = await getClinicPlanData();
    const emailAllowed = Boolean(
      planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
    );
    const whatsappAllowed = Boolean(
      planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
    );

    const { data: integrations, error } = await supabase
      .from("clinic_integrations")
      .select("id, integration_type, status, metadata, connected_at, last_sync_at, error_message")
      .eq("clinic_id", admin.clinicId)
      .order("integration_type");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const filtered = (integrations || []).filter((row) => {
      if (row.integration_type === "email_google") return emailAllowed;
      if (row.integration_type === "whatsapp_meta" || row.integration_type === "whatsapp_simple") {
        return whatsappAllowed;
      }
      return true;
    });
    return NextResponse.json({ integrations: filtered });
  } catch (error) {
    console.error("Erro ao listar integrações:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar integrações" },
      { status: 500 }
    );
  }
}
