import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClinicContext } from "./clinic-context";

/** @deprecated Use buildClinicContext + composeSystemPrompt */
export async function buildKnowledgeContext(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string> {
  const { text } = await buildClinicContext(supabase, clinicId);
  return text;
}

/** @deprecated Use prompt-decision.ts */
export function buildBehaviorInstructions(): string {
  return "";
}
