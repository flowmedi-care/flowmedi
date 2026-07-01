import type { SupabaseClient } from "@supabase/supabase-js";
import { findDuplicatePipeline } from "@/lib/contact-journey/edge-cases";
import { inferSourceFromReferral } from "@/lib/contact-journey/intent-classifier";

export type UpsertWhatsappLeadInput = {
  clinicId: string;
  phone: string;
  name?: string | null;
  referral?: { source_type?: string; source_url?: string } | null;
};

function phoneToPlaceholderEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `wpp+${digits}@lead.flowmedi.local`;
}

/**
 * Cria ou atualiza contato no pipeline quando número novo entra pelo WhatsApp.
 * Não cria paciente — apenas lead/contato.
 */
export async function upsertWhatsappPipelineLead(
  supabase: SupabaseClient,
  input: UpsertWhatsappLeadInput
): Promise<{ pipelineId?: string; created: boolean; error?: string }> {
  const { clinicId, phone, name, referral } = input;
  const normalizedPhone = phone.replace(/\D/g, "");
  if (!normalizedPhone) return { created: false, error: "Telefone inválido" };

  const now = new Date().toISOString();

  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone}`)
    .maybeSingle();

  if (existingPatient?.id) {
    return { created: false };
  }

  const placeholderEmail = phoneToPlaceholderEmail(normalizedPhone);

  const duplicateId = await findDuplicatePipeline(supabase, clinicId, normalizedPhone, placeholderEmail);
  if (duplicateId) {
    await supabase
      .from("non_registered_pipeline")
      .update({
        phone: normalizedPhone,
        name: name ?? undefined,
        last_contact_at: now,
        updated_at: now,
      })
      .eq("id", duplicateId);
    return { pipelineId: duplicateId, created: false };
  }

  const { data: existingLead } = await supabase
    .from("non_registered_pipeline")
    .select("id, source, phone, name")
    .eq("clinic_id", clinicId)
    .eq("email", placeholderEmail)
    .maybeSingle();

  const sourceRaw = inferSourceFromReferral(referral);
  const source = ["form", "site", "manual", "whatsapp"].includes(sourceRaw)
    ? sourceRaw
    : "whatsapp";

  if (existingLead?.id) {
    await supabase
      .from("non_registered_pipeline")
      .update({
        phone: normalizedPhone,
        name: name ?? existingLead.name,
        last_contact_at: now,
        updated_at: now,
      })
      .eq("id", existingLead.id);

    return { pipelineId: existingLead.id, created: false };
  }

  const { data: inserted, error } = await supabase
    .from("non_registered_pipeline")
    .insert({
      clinic_id: clinicId,
      email: placeholderEmail,
      phone: normalizedPhone,
      name: name ?? null,
      stage: "novo_contato",
      lifecycle_stage: "lead_novo",
      source,
      last_contact_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    return { created: false, error: error.message };
  }

  if (inserted?.id) {
    await supabase.from("non_registered_history").insert({
      pipeline_id: inserted.id,
      action_type: "contact_made",
      new_stage: "novo_contato",
      notes: `Contato via WhatsApp (${source})`,
    });
  }

  return { pipelineId: inserted?.id, created: true };
}
