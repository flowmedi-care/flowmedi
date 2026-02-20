import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/patients/custom-fields
 * Retorna os campos customizados de pacientes da clínica.
 */
export async function GET() {
  try {
    const { clinicId } = await requireClinicMember();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("patient_custom_fields")
      .select("id, field_name, field_type, field_label, required, options, display_order")
      .eq("clinic_id", clinicId)
      .order("display_order");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar campos";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
