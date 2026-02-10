"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type DoctorPreferences = {
  late_threshold_minutes: number; // Padrão: 15 minutos
};

const DEFAULT_PREFERENCES: DoctorPreferences = {
  late_threshold_minutes: 15,
};

export async function getDoctorPreferences(): Promise<{
  data: DoctorPreferences | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { data: DEFAULT_PREFERENCES, error: null };
  }

  const preferences = (profile.preferences as Record<string, unknown>) || {};
  const doctorPrefs = preferences.doctor as DoctorPreferences | undefined;

  return {
    data: {
      late_threshold_minutes: doctorPrefs?.late_threshold_minutes ?? DEFAULT_PREFERENCES.late_threshold_minutes,
    },
    error: null,
  };
}

export async function updateDoctorPreferences(
  preferences: Partial<DoctorPreferences>
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Buscar preferências atuais
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "Perfil não encontrado." };
  }

  const currentPreferences = (profile.preferences as Record<string, unknown>) || {};
  const currentDoctorPrefs = (currentPreferences.doctor as DoctorPreferences) || DEFAULT_PREFERENCES;

  // Atualizar apenas as preferências do médico
  const updatedPreferences = {
    ...currentPreferences,
    doctor: {
      ...currentDoctorPrefs,
      ...preferences,
    },
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      preferences: updatedPreferences,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}
