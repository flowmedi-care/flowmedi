"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData, countDoctors, countSecretaries } from "@/lib/plan-helpers";
import { canAddDoctor, canAddSecretary, getUpgradeMessage } from "@/lib/plan-gates";

export async function createInvite(
  email: string,
  role: "medico" | "secretaria"
): Promise<{ error: string | null; token: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", token: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.clinic_id) {
    return { error: "Apenas administradores podem criar convites.", token: null };
  }

  // Verificar limites do plano
  const planData = await getClinicPlanData();
  if (!planData) {
    return { error: "Erro ao verificar plano da clínica.", token: null };
  }

  if (role === "medico") {
    const currentCount = await countDoctors(profile.clinic_id);
    const check = canAddDoctor(planData.limits, currentCount);
    
    if (!check.allowed) {
      const upgradeMsg = getUpgradeMessage("médicos");
      return {
        error: `${check.reason}. ${upgradeMsg}`,
        token: null,
      };
    }
  } else if (role === "secretaria") {
    const currentCount = await countSecretaries(profile.clinic_id);
    const check = canAddSecretary(planData.limits, currentCount);
    
    if (!check.allowed) {
      const upgradeMsg = getUpgradeMessage("secretários");
      return {
        error: `${check.reason}. ${upgradeMsg}`,
        token: null,
      };
    }
  }

  // Criar convite
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: err } = await supabase.from("invites").insert({
    clinic_id: profile.clinic_id,
    email: email.trim(),
    role,
    token,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (err) {
    return { error: err.message, token: null };
  }

  revalidatePath("/dashboard/equipe");
  return { error: null, token };
}
