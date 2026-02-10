"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type DashboardPreferences = {
  show_compliance: boolean;
  show_metrics: boolean;
  show_pipeline: boolean;
  show_upcoming_appointments: boolean;
  show_recent_activity: boolean;
};

// Buscar preferências do dashboard
export async function getDashboardPreferences() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: preferences, error } = await supabase
    .from("dashboard_preferences")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message, data: null };

  // Se não existir, retornar padrões
  if (!preferences) {
    const defaultPrefs: DashboardPreferences = {
      show_compliance: true,
      show_metrics: true,
      show_pipeline: true,
      show_upcoming_appointments: true,
      show_recent_activity: false,
    };
    return { error: null, data: defaultPrefs };
  }

  return {
    error: null,
    data: {
      show_compliance: preferences.show_compliance,
      show_metrics: preferences.show_metrics,
      show_pipeline: preferences.show_pipeline,
      show_upcoming_appointments: preferences.show_upcoming_appointments,
      show_recent_activity: preferences.show_recent_activity,
    },
  };
}

// Atualizar preferências do dashboard
export async function updateDashboardPreferences(
  preferences: Partial<DashboardPreferences>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Verificar se já existe
  const { data: existing } = await supabase
    .from("dashboard_preferences")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing) {
    // Atualizar
    const { error } = await supabase
      .from("dashboard_preferences")
      .update({
        ...preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", user.id);

    if (error) return { error: error.message };
  } else {
    // Criar
    const { error } = await supabase
      .from("dashboard_preferences")
      .insert({
        profile_id: user.id,
        show_compliance: preferences.show_compliance ?? true,
        show_metrics: preferences.show_metrics ?? true,
        show_pipeline: preferences.show_pipeline ?? true,
        show_upcoming_appointments: preferences.show_upcoming_appointments ?? true,
        show_recent_activity: preferences.show_recent_activity ?? false,
      });

    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { error: null };
}
