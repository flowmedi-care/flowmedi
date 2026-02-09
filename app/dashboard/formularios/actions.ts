"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormTemplateDefinition } from "@/lib/form-types";

export async function createFormTemplate(
  name: string,
  definition: FormTemplateDefinition,
  appointmentTypeId: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { error } = await supabase.from("form_templates").insert({
    clinic_id: profile.clinic_id,
    name: name.trim(),
    definition: definition as unknown as Record<string, unknown>[],
    appointment_type_id: appointmentTypeId || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  return { error: null };
}

export async function updateFormTemplate(
  id: string,
  name: string,
  definition: FormTemplateDefinition,
  appointmentTypeId: string | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .update({
      name: name.trim(),
      definition: definition as unknown as Record<string, unknown>[],
      appointment_type_id: appointmentTypeId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  revalidatePath(`/dashboard/formularios/${id}`);
  return { error: null };
}

export async function deleteFormTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("form_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  return { error: null };
}
