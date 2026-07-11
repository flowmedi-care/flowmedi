import type { SupabaseClient } from "@supabase/supabase-js";
import {
  linkConversationToPatient,
  lookupPatientByPhone,
} from "@/lib/virtual-assistant/services/patients";

/** Resolve patient by phone and link conversation when missing patient_id. */
export async function ensurePatientLinkedByPhone(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  phoneNumber: string,
  existingPatientId?: string | null
): Promise<string | null> {
  if (existingPatientId) return existingPatientId;

  const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
  if (!patient?.id) return null;

  await linkConversationToPatient(supabase, clinicId, conversationId, patient.id);
  return patient.id;
}
