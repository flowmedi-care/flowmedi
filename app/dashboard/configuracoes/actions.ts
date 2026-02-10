"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function uploadLogoToStorage(file: File, path: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from("logos")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) return { error: error.message };

  const { data: { publicUrl } } = supabase.storage
    .from("logos")
    .getPublicUrl(path);

  return { url: publicUrl };
}

export async function uploadClinicLogo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem fazer upload da logo da clínica." };
  }

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo selecionado." };

  const path = `clinic-${profile.clinic_id}.${file.name.split(".").pop()}`;
  const uploadResult = await uploadLogoToStorage(file, path);

  if ("error" in uploadResult) {
    return uploadResult;
  }

  const { error } = await supabase
    .from("clinics")
    .update({ logo_url: uploadResult.url })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { url: uploadResult.url };
}

export async function deleteClinicLogo() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem remover a logo da clínica." };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("logo_url")
    .eq("id", profile.clinic_id)
    .single();

  if (clinic?.logo_url) {
    const path = clinic.logo_url.split("/logos/")[1];
    if (path) {
      await supabase.storage.from("logos").remove([path]);
    }
  }

  const { error } = await supabase
    .from("clinics")
    .update({ logo_url: null })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function uploadDoctorLogo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico") {
    return { error: "Apenas médicos podem fazer upload da sua logo." };
  }

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo selecionado." };

  const path = `doctor-${user.id}.${file.name.split(".").pop()}`;
  const uploadResult = await uploadLogoToStorage(file, path);

  if ("error" in uploadResult) {
    return uploadResult;
  }

  // Usa função RPC para contornar problemas de RLS
  const { error } = await supabase.rpc("update_profile_logo_url", {
    p_user_id: user.id,
    p_logo_url: uploadResult.url,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { url: uploadResult.url };
}

export async function deleteDoctorLogo() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("logo_url")
    .eq("id", user.id)
    .single();

  if (profile?.logo_url) {
    const path = profile.logo_url.split("/logos/")[1];
    if (path) {
      await supabase.storage.from("logos").remove([path]);
    }
  }

  // Usa função RPC para contornar problemas de RLS
  const { error } = await supabase.rpc("update_profile_logo_url", {
    p_user_id: user.id,
    p_logo_url: null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { error: null };
}

export async function updateClinicLogoScale(scale: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem ajustar a escala da logo da clínica." };
  }

  // Validar escala
  if (scale < 50 || scale > 200) {
    return { error: "A escala deve estar entre 50% e 200%." };
  }

  const { error } = await supabase
    .from("clinics")
    .update({ logo_scale: scale })
    .eq("id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function updateDoctorLogoScale(scale: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Validar escala
  if (scale < 50 || scale > 200) {
    return { error: "A escala deve estar entre 50% e 200%." };
  }

  // Usa função RPC para contornar problemas de RLS
  const { error } = await supabase.rpc("update_profile_logo_scale", {
    p_user_id: user.id,
    p_logo_scale: scale,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { error: null };
}

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
