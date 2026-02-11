import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";

/**
 * Desconecta a integração do Google
 * POST /api/integrations/google/disconnect
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("clinic_integrations")
      .update({
        status: "disconnected",
        credentials: {},
        metadata: {},
        connected_at: null,
        last_sync_at: null,
        error_message: null,
      })
      .eq("clinic_id", admin.clinicId)
      .eq("integration_type", "email_google");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desconectar Google:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao desconectar" },
      { status: 500 }
    );
  }
}
