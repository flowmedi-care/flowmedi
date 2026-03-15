import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * GET /api/patients/search?q=nome
 * Retorna contatos de pacientes da clínica para seleção rápida no WhatsApp.
 */
export async function GET(request: Request) {
  try {
    const { clinicId } = await requireClinicMember();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    const supabase = await createClient();
    let query = supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinicId)
      .not("phone", "is", null)
      .order("full_name", { ascending: true })
      .limit(30);

    if (q) {
      query = query.ilike("full_name", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const contacts = (data ?? [])
      .map((row) => ({
        id: String(row.id),
        full_name: row.full_name ? String(row.full_name) : null,
        phone: row.phone ? String(row.phone) : "",
      }))
      .filter((row) => row.phone.trim().length > 0);

    return NextResponse.json({ contacts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar contatos";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
