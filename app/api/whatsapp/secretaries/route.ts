import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/whatsapp/secretaries
 * Lista secretárias da clínica (para dropdown de encaminhamento).
 */
export async function GET() {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("clinic_id", clinicId)
      .eq("role", "secretaria")
      .eq("active", true)
      .order("full_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      (data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name ?? "Sem nome",
        email: p.email,
      }))
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar secretárias";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
