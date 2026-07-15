"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  AppointmentPolicyInput,
  CheckInPolicyInput,
  GoalPolicyLevel,
} from "@/lib/attendance-flow/types";
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
      clinic?.appointment_policy as AppointmentPolicyInput | null
    ),
  };
}

/** @deprecated prefer saveAppointmentPolicyPatch — kept for old callers. */
export async function saveAppointmentPolicy(goals: Record<string, string>) {
  return saveAppointmentPolicyPatch({ goals });
}

export async function saveAppointmentPolicyPatch(input: {
  goals?: Record<string, string | GoalPolicyLevel>;
  check_in?: CheckInPolicyInput;
}) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.supabase || !ctx.clinicId) return { error: ctx.error };

  const { data: clinic } = await ctx.supabase
    .from("clinics")
    .select("appointment_policy")
    .eq("id", ctx.clinicId)
    .single();

  const merged = mergeAppointmentPolicy(
    clinic?.appointment_policy as AppointmentPolicyInput | null
  );

  let nextGoals = merged.goals;
  if (input.goals) {
    const sanitized: Record<string, GoalPolicyLevel> = { ...merged.goals };
    for (const [k, v] of Object.entries(input.goals)) {
      if (v === "ignore" || v === "optional" || v === "required") {
        sanitized[k] = v;
      }
    }
    nextGoals = sanitized;
  }

  const nextCheckIn = mergeAppointmentPolicy({
    check_in: { ...merged.check_in, ...input.check_in, window: {
      ...merged.check_in.window,
      ...input.check_in?.window,
    } },
  }).check_in;

  const { error } = await ctx.supabase
    .from("clinics")
    .update({
      appointment_policy: {
        goals: nextGoals,
        check_in: input.check_in ? nextCheckIn : merged.check_in,
      },
    })
    .eq("id", ctx.clinicId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracoes/agendamento");
  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  return { error: null };
}
