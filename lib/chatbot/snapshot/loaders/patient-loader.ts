import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupPatientByPhone } from "@/lib/virtual-assistant/services/patients";

export type PatientSlice = {
  id: string;
  full_name: string;
  display_name: string;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  birth_date: string | null;
  age: number | null;
  custom_fields: Record<string, unknown>;
};

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

export async function loadPatientSlice(
  supabase: SupabaseClient,
  clinicId: string,
  opts: { patientId?: string | null; phone?: string | null }
): Promise<PatientSlice | null> {
  if (opts.patientId) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, email, phone, birth_date, cpf, custom_fields")
      .eq("clinic_id", clinicId)
      .eq("id", opts.patientId)
      .maybeSingle();
    if (!data) return null;
    const firstName =
      String(data.full_name ?? "").trim().split(/\s+/)[0] || String(data.full_name ?? "");
    return {
      id: data.id,
      full_name: String(data.full_name ?? ""),
      display_name: firstName,
      email: data.email ? String(data.email) : null,
      cpf: data.cpf ? String(data.cpf).replace(/\D/g, "") || null : null,
      phone: data.phone ? String(data.phone) : null,
      birth_date: data.birth_date ? String(data.birth_date) : null,
      age: computeAge(data.birth_date ? String(data.birth_date) : null),
      custom_fields: (data.custom_fields as Record<string, unknown>) ?? {},
    };
  }

  if (opts.phone) {
    const row = await lookupPatientByPhone(supabase, clinicId, opts.phone);
    if (!row) return null;
    const firstName =
      String(row.full_name ?? "").trim().split(/\s+/)[0] || String(row.full_name ?? "");
    const custom = (row.custom_fields as Record<string, unknown> | null) ?? {};
    const cpfRaw = row.cpf;
    return {
      id: row.id,
      full_name: String(row.full_name ?? ""),
      display_name: firstName,
      email: row.email ? String(row.email) : null,
      cpf: cpfRaw ? String(cpfRaw).replace(/\D/g, "") || null : null,
      phone: row.phone ? String(row.phone) : null,
      birth_date: row.birth_date ? String(row.birth_date) : null,
      age: computeAge(row.birth_date ? String(row.birth_date) : null),
      custom_fields: custom,
    };
  }

  return null;
}
