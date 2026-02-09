"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createAppointmentType(name: string, duration_minutes: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Apenas administradores podem criar tipos de consulta." };
  }

  const { error } = await supabase.from("appointment_types").insert({
    clinic_id: profile.clinic_id,
    name: name.trim(),
    duration_minutes: duration_minutes || 30,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function updateAppointmentType(
  id: string,
  data: { name: string; duration_minutes: number }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Não autorizado." };

  const { error } = await supabase
    .from("appointment_types")
    .update({
      name: data.name.trim(),
      duration_minutes: data.duration_minutes || 30,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function deleteAppointmentType(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Não autorizado." };

  const { error } = await supabase.from("appointment_types").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}
