import { Suspense } from "react";
import { getOnboardingState } from "@/lib/onboarding/state";
import { JourneyCoach } from "./journey-coach";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Coach de ativação no layout do dashboard (admin). */
export async function ActivationAhaIfNeeded({
  supabase,
  clinicId,
  role,
}: {
  supabase: Supabase;
  clinicId: string;
  role: string;
}) {
  if (role !== "admin") return null;
  const state = await getOnboardingState(supabase, clinicId);
  if (!state) return null;

  if (state.tourStep === "aha") {
    return (
      <Suspense fallback={null}>
        <JourneyCoach
          initialStep="aha"
          bundle={state.bundle}
          showFullAhaInitially
        />
      </Suspense>
    );
  }

  if (state.showCoach) {
    return (
      <Suspense fallback={null}>
        <JourneyCoach initialStep={state.tourStep} bundle={state.bundle} />
      </Suspense>
    );
  }

  return null;
}
