"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { seedClinicDemoBundle } from "./seed";
import { purgeDemoBundle } from "./purge";
import { getOnboardingState, patchOnboardingClinic } from "./state";
import { trackProductEvent } from "./events";
import { microWinForStep } from "./copy";
import type { OnboardingDemoBundle, OnboardingTourStep, ProductEventName } from "./types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." as const, supabase, profile: null, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Apenas admin." as const, supabase, profile: null, user };
  }
  return { error: null, supabase, profile, user };
}

export async function ensureActivationSeedAction(): Promise<{
  caseId: string | null;
  bundle: OnboardingDemoBundle | null;
  error: string | null;
}> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { caseId: null, bundle: null, error: ctx.error ?? "Não autorizado." };
  }

  const result = await seedClinicDemoBundle(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    adminUserId: ctx.profile.id,
    adminFullName: ctx.profile.full_name,
  });

  return {
    caseId: result.caseId,
    bundle: result.bundle,
    error: result.error,
  };
}

export async function getOnboardingStateAction() {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile) return { data: null, error: ctx.error };
  const data = await getOnboardingState(ctx.supabase, ctx.profile.clinic_id);
  return { data, error: null };
}

export async function advanceTourStepAction(
  step: OnboardingTourStep,
  extra?: { appointmentId?: string }
): Promise<{ error: string | null; microWin: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado.", microWin: null };
  }

  const state = await getOnboardingState(ctx.supabase, ctx.profile.clinic_id);
  const bundle = state?.bundle ? { ...state.bundle } : null;
  if (extra?.appointmentId && bundle) {
    bundle.appointmentId = extra.appointmentId;
  }

  const patch: Record<string, unknown> = {
    onboarding_tour_step: step,
  };
  if (bundle) patch.onboarding_demo_bundle = bundle;

  const res = await patchOnboardingClinic(ctx.supabase, ctx.profile.clinic_id, patch);
  if (res.error) return { error: res.error, microWin: null };

  const microWin = microWinForStep(step);
  if (microWin) {
    await trackProductEvent(ctx.supabase, {
      clinicId: ctx.profile.clinic_id,
      userId: ctx.user.id,
      event: "micro_win",
      properties: { step, message: microWin },
    });
  }

  revalidatePath("/dashboard");
  return { error: null, microWin };
}

export async function completeMiniAhaAction(appointmentId: string): Promise<{
  error: string | null;
}> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado." };
  }

  const state = await getOnboardingState(ctx.supabase, ctx.profile.clinic_id);
  const bundle = state?.bundle ? { ...state.bundle, appointmentId } : null;

  await patchOnboardingClinic(ctx.supabase, ctx.profile.clinic_id, {
    onboarding_tour_step: "attendance",
    onboarding_mini_aha_at: new Date().toISOString(),
    ...(bundle ? { onboarding_demo_bundle: bundle } : {}),
  });

  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "mini_aha_completed",
    properties: { appointmentId },
  });
  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "micro_win",
    properties: { step: "appointment", message: "Sua agenda já tem um atendimento." },
  });

  revalidatePath("/dashboard");
  return { error: null };
}

export async function continueAfterMiniAhaAction(): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado." };
  }
  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "continued_after_mini",
  });
  return { error: null };
}

export async function completeAhaAction(): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado." };
  }

  await patchOnboardingClinic(ctx.supabase, ctx.profile.clinic_id, {
    onboarding_tour_step: "aha",
    onboarding_aha_completed_at: new Date().toISOString(),
  });

  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "aha_completed",
  });
  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "micro_win",
    properties: { step: "aha", message: "Você viu o FlowMedi completo." },
  });

  revalidatePath("/dashboard");
  return { error: null };
}

export async function markAhaDoneAction(): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile) return { error: ctx.error ?? "Não autorizado." };
  await patchOnboardingClinic(ctx.supabase, ctx.profile.clinic_id, {
    onboarding_tour_step: "done",
  });
  revalidatePath("/dashboard");
  return { error: null };
}

export async function skipTourAction(): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado." };
  }
  await patchOnboardingClinic(ctx.supabase, ctx.profile.clinic_id, {
    onboarding_tour_step: "skipped",
  });
  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "tour_skipped",
  });
  revalidatePath("/dashboard");
  return { error: null };
}

export async function markMariaWhySeenAction(): Promise<void> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) return;
  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event: "maria_why_seen",
  });
}

export async function trackActivationEventAction(
  event: ProductEventName,
  properties?: Record<string, unknown>
): Promise<void> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) return;
  await trackProductEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
    event,
    properties,
  });
}

export async function purgeOnboardingDemoAction(): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado." };
  }
  const res = await purgeDemoBundle(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    userId: ctx.user.id,
  });
  revalidatePath("/dashboard");
  return res;
}

export async function setAdminAlsoPracticesAction(
  value: boolean
): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile) return { error: ctx.error ?? "Não autorizado." };
  const res = await patchOnboardingClinic(ctx.supabase, ctx.profile.clinic_id, {
    admin_also_practices: value,
  });
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/configuracoes");
  return res;
}

/**
 * Atalho demo: inicia/finaliza atendimento, gera comanda e avança tour para payment.
 */
export async function completeDemoAttendanceAction(appointmentId: string): Promise<{
  error: string | null;
  comandaId?: string | null;
}> {
  const ctx = await requireAdmin();
  if (ctx.error || !ctx.profile || !ctx.user) {
    return { error: ctx.error ?? "Não autorizado." };
  }

  const { updateAppointment } = await import("@/app/dashboard/agenda/actions");
  const {
    beginAppointmentCare,
    finishClinicalEncounter,
    createScheduleComanda,
  } = await import("@/app/dashboard/agenda/encounter-actions");

  await updateAppointment(appointmentId, { status: "confirmada" });
  await beginAppointmentCare(appointmentId);

  const finishRes = await finishClinicalEncounter(appointmentId);
  if (finishRes.error && !finishRes.alreadyFinished) {
    await updateAppointment(appointmentId, { status: "realizada" });
  }

  const comandaRes = await createScheduleComanda(appointmentId);
  if (comandaRes.error) {
    return { error: comandaRes.error };
  }

  await advanceTourStepAction("payment", { appointmentId });

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath(`/dashboard/agenda/atendimento/${appointmentId}`);

  return { error: null, comandaId: comandaRes.comandaId ?? null };
}

/** Reexport seed via demo button compatibility. */
export async function createDemoAtendimentoFromActivation(): Promise<{
  caseId: string | null;
  error: string | null;
}> {
  const res = await ensureActivationSeedAction();
  return { caseId: res.caseId, error: res.error };
}
