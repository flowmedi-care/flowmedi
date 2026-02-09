"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PatientInsert = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  notes?: string | null;
};

export type PatientUpdate = Partial<PatientInsert>;

export async function createPatient(data: PatientInsert) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada." };
  }

  const { error } = await supabase.from("patients").insert({
    clinic_id: profile.clinic_id,
    full_name: data.full_name,
    email: data.email || null,
    phone: data.phone || null,
    birth_date: data.birth_date || null,
    notes: data.notes || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { error: null };
}

export async function updatePatient(id: string, data: PatientUpdate) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      full_name: data.full_name,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      birth_date: data.birth_date || null,
      notes: data.notes ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { error: null };
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/pacientes");
  return { error: null };
}
