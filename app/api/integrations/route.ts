import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Lista integrações da clínica
 * GET /api/integrations
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();

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

    return NextResponse.json({ integrations: integrations || [] });
  } catch (error) {
    console.error("Erro ao listar integrações:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar integrações" },
      { status: 500 }
    );
  }
}
