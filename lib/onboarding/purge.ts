import type { SupabaseClient } from "@supabase/supabase-js";
import { getOnboardingState, patchOnboardingClinic } from "./state";
import { trackProductEvent } from "./events";

/** Remove entidades do bundle demo e limpa flags de ativação. */
export async function purgeDemoBundle(
  supabase: SupabaseClient,
  params: { clinicId: string; userId: string }
): Promise<{ error: string | null }> {
  const state = await getOnboardingState(supabase, params.clinicId);
  const bundle = state?.bundle;
  if (!bundle) {
    await patchOnboardingClinic(supabase, params.clinicId, {
      onboarding_demo_bundle: null,
      onboarding_demo_seeded_at: null,
      onboarding_tour_step: "done",
    });
    return { error: null };
  }

  // Ordem: appointments → case leftovers → lead → patient → prices → procedures → services → rooms
  if (bundle.appointmentId) {
    await supabase
      .from("appointments")
      .delete()
      .eq("id", bundle.appointmentId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.caseId) {
    await supabase
      .from("journey_cases")
      .delete()
      .eq("id", bundle.caseId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.leadId) {
    await supabase
      .from("non_registered_pipeline")
      .delete()
      .eq("id", bundle.leadId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.patientId) {
    await supabase
      .from("patients")
      .delete()
      .eq("id", bundle.patientId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.servicePriceId) {
    await supabase
      .from("service_prices")
      .delete()
      .eq("id", bundle.servicePriceId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.procedureId) {
    await supabase
      .from("procedures")
      .delete()
      .eq("id", bundle.procedureId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.serviceId) {
    await supabase
      .from("services")
      .delete()
      .eq("id", bundle.serviceId)
      .eq("clinic_id", params.clinicId);
  }

  if (bundle.roomId) {
    await supabase
      .from("rooms")
      .delete()
      .eq("id", bundle.roomId)
      .eq("clinic_id", params.clinicId);
  }

  await patchOnboardingClinic(supabase, params.clinicId, {
    onboarding_demo_bundle: null,
    onboarding_demo_seeded_at: null,
    onboarding_tour_step: "done",
  });

  await trackProductEvent(supabase, {
    clinicId: params.clinicId,
    userId: params.userId,
    event: "post_aha_real_action",
    properties: { type: "purge_demo" },
  });

  return { error: null };
}
