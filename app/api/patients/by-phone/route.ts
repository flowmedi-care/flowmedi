import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireClinicMember } from "@/lib/auth-helpers";

/**
 * Normaliza telefone para comparação: remove 55 do início se for BR, retorna só dígitos.
 */
function normalizePhoneForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.slice(2); // remove 55 (BR)
  }
  return digits;
}

/**
 * GET /api/patients/by-phone?phone=5562996915034
 * Busca paciente da clínica pelo telefone (WhatsApp geralmente vem com 55).
 */
export async function GET(request: Request) {
  try {
    const { clinicId } = await requireClinicMember();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    if (!phone?.trim()) {
      return NextResponse.json({ error: "Telefone obrigatório" }, { status: 400 });
    }

    const normalized = normalizePhoneForMatch(phone);
    if (normalized.length < 10) {
      return NextResponse.json({ patient: null });
    }

    const supabase = await createClient();
    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, email, phone, birth_date, notes, custom_fields, created_at")
      .eq("clinic_id", clinicId)
      .not("phone", "is", null);

    const patient = (patients ?? []).find((p) => {
      const pDigits = (p.phone ?? "").replace(/\D/g, "");
      if (!pDigits) return false;
      // Match exato ou WhatsApp com 55 + patient phone
      return pDigits === normalized || `55${pDigits}` === phone.replace(/\D/g, "");
    });

    if (!patient) {
      return NextResponse.json({ patient: null });
    }

    return NextResponse.json({
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        birth_date: patient.birth_date,
        notes: patient.notes,
        custom_fields: patient.custom_fields ?? {},
        created_at: patient.created_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar paciente";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
