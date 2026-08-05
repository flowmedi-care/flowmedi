import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductEventName } from "./types";
import { captureServerEvent } from "@/lib/posthog/server";

/** Best-effort product analytics. Never throws. */
export async function trackProductEvent(
  supabase: SupabaseClient,
  params: {
    clinicId: string | null;
    userId: string | null;
    event: ProductEventName;
    properties?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("product_events").insert({
      clinic_id: params.clinicId,
      user_id: params.userId,
      event: params.event,
      properties: params.properties ?? {},
    });
    if (error) {
      console.error("[product_events]", error.message);
    }
  } catch (err) {
    console.error("[product_events]", err);
  }

  if (params.userId) {
    await captureServerEvent({
      distinctId: params.userId,
      event: params.event,
      properties: {
        ...params.properties,
        clinic_id: params.clinicId,
        source: "product_events",
      },
      groups: params.clinicId ? { clinic: params.clinicId } : undefined,
    });
  }
}
