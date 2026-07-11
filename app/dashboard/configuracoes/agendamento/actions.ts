"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AppointmentPolicy } from "@/lib/attendance-flow/types";
import { mergeAppointmentPolicy } from "@/lib/attendance-flow/defaults";

async function requireAdminClinic() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase: null, clinicId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores.", supabase: null, clinicId: null };
  }

  return { error: null, supabase, clinicId: profile.clinic_id };
}

export async function getAgendamentoPolicyPageData() {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const { data: clinic } = await ctx.supabase
    .from("clinics")
    .select("appointment_policy")
    .eq("id", ctx.clinicId)
    .single();

  return {
    error: null,
    policy: mergeAppointmentPolicy(
      clinic?.appointment_policy as Partial<AppointmentPolicy> | null
    ),
  };
}

export async function saveAppointmentPolicy(goals: Record<string, string>) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const sanitized: Record<string, "ignore" | "optional" | "required"> = {};
  for (const [k, v] of Object.entries(goals)) {
    if (v === "ignore" || v === "optional" || v === "required") {
      sanitized[k] = v;
    }
  }

  const { error } = await ctx.supabase
    .from("clinics")
    .update({ appointment_policy: { goals: sanitized } })
    .eq("id", ctx.clinicId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracoes/agendamento");
  return { error: null };
}
