import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OnboardingDemoBundle,
  OnboardingState,
  OnboardingTourStep,
} from "./types";

function parseBundle(raw: unknown): OnboardingDemoBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const story = b.story as OnboardingDemoBundle["story"] | undefined;
  if (!story?.name) return null;
  return {
    leadId: b.leadId ? String(b.leadId) : undefined,
    caseId: b.caseId ? String(b.caseId) : undefined,
    patientId: b.patientId ? String(b.patientId) : undefined,
    serviceId: b.serviceId ? String(b.serviceId) : undefined,
    procedureId: b.procedureId ? String(b.procedureId) : undefined,
    roomId: b.roomId ? String(b.roomId) : undefined,
    doctorId: b.doctorId ? String(b.doctorId) : undefined,
    appointmentId: b.appointmentId ? String(b.appointmentId) : undefined,
    servicePriceId: b.servicePriceId ? String(b.servicePriceId) : undefined,
    story: {
      name: String(story.name),
      channelLabel: String(story.channelLabel ?? ""),
      reasonLabel: String(story.reasonLabel ?? ""),
      isDemo: true,
    },
  };
}

function parseStep(raw: unknown): OnboardingTourStep | null {
  const allowed: OnboardingTourStep[] = [
    "contact",
    "appointment",
    "attendance",
    "payment",
    "aha",
    "done",
    "skipped",
  ];
  if (typeof raw !== "string") return null;
  return allowed.includes(raw as OnboardingTourStep)
    ? (raw as OnboardingTourStep)
    : null;
}

export async function getOnboardingState(
  supabase: SupabaseClient,
  clinicId: string
): Promise<OnboardingState | null> {
  const { data, error } = await supabase
    .from("clinics")
    .select(
      "id, admin_also_practices, onboarding_tour_step, onboarding_mini_aha_at, onboarding_aha_completed_at, onboarding_demo_seeded_at, onboarding_demo_bundle"
    )
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !data) {
    // Colunas podem não existir ainda — fallback silencioso
    if (error) console.error("[getOnboardingState]", error.message);
    return null;
  }

  const tourStep = parseStep(data.onboarding_tour_step);
  const ahaCompletedAt = data.onboarding_aha_completed_at
    ? String(data.onboarding_aha_completed_at)
    : null;
  const isActive =
    !ahaCompletedAt && tourStep !== "done" && tourStep !== "skipped";

  return {
    clinicId: String(data.id),
    adminAlsoPractices: data.admin_also_practices !== false,
    tourStep,
    miniAhaAt: data.onboarding_mini_aha_at
      ? String(data.onboarding_mini_aha_at)
      : null,
    ahaCompletedAt,
    demoSeededAt: data.onboarding_demo_seeded_at
      ? String(data.onboarding_demo_seeded_at)
      : null,
    bundle: parseBundle(data.onboarding_demo_bundle),
    isActive,
    showCoach: Boolean(isActive && data.onboarding_demo_seeded_at),
  };
}

export async function patchOnboardingClinic(
  supabase: SupabaseClient,
  clinicId: string,
  patch: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("clinics")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", clinicId);
  if (error) return { error: error.message };
  return { error: null };
}
