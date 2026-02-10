"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CustomFieldInsert = {
  field_name: string;
  field_type: "text" | "number" | "date" | "textarea" | "select";
  field_label: string;
  required: boolean;
  options?: string[];
  display_order: number;
};

export type CustomFieldUpdate = Partial<CustomFieldInsert>;

export async function createCustomField(data: CustomFieldInsert) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem criar campos." };
  }

  const { error } = await supabase.from("patient_custom_fields").insert({
    clinic_id: profile.clinic_id,
    field_name: data.field_name,
    field_type: data.field_type,
    field_label: data.field_label,
    required: data.required,
    options: data.options || null,
    display_order: data.display_order,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function updateCustomField(id: string, data: CustomFieldUpdate) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem editar campos." };
  }

  const { error } = await supabase
    .from("patient_custom_fields")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function deleteCustomField(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem excluir campos." };
  }

  const { error } = await supabase
    .from("patient_custom_fields")
    .delete()
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}
