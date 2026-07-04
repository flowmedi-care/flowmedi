import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inferObjectionFromConversation,
  type ObjectionInference,
} from "./objection-inference";
import type { JourneyStepCode } from "./types";

export type DropoutInferenceInput = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  journeyStep?: JourneyStepCode | null;
};

export type DropoutInferenceResult = ObjectionInference & {
  journeyStep?: JourneyStepCode | null;
};

export function inferDropoutReason(input: DropoutInferenceInput): DropoutInferenceResult {
  const base = inferObjectionFromConversation(input.messages);
  return {
    ...base,
    journeyStep: input.journeyStep ?? null,
  };
}

export async function loadRecentConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 20
): Promise<{ role: "user" | "assistant" | "system"; content: string }[]> {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("direction, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: String(m.body ?? ""),
    }))
    .filter((m) => m.content.trim().length > 0);
}

export async function persistDropoutReason(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    patientId?: string | null;
    leadId?: string | null;
    motivoProvavel: string;
    confianca: string;
    rationale: string;
    journeyStep?: string | null;
  }
): Promise<void> {
  if (opts.leadId) {
    await supabase
      .from("leads")
      .update({ loss_reason: opts.motivoProvavel, updated_at: new Date().toISOString() })
      .eq("id", opts.leadId)
      .eq("clinic_id", opts.clinicId);
    return;
  }

  if (opts.patientId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("clinic_id", opts.clinicId)
      .eq("patient_id", opts.patientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead?.id) {
      await supabase
        .from("leads")
        .update({ loss_reason: opts.motivoProvavel, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
  }

  await supabase.from("whatsapp_ai_events").insert({
    clinic_id: opts.clinicId,
    stage: "dropout_reason_inferred",
    level: "info",
    detail: {
      motivo_provavel: opts.motivoProvavel,
      confianca: opts.confianca,
      rationale: opts.rationale,
      journey_step: opts.journeyStep ?? null,
      patient_id: opts.patientId ?? null,
      lead_id: opts.leadId ?? null,
    },
  });
}

export async function inferAndPersistDropoutForConversation(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    patientId?: string | null;
    journeyStep?: JourneyStepCode | null;
  }
): Promise<DropoutInferenceResult> {
  const messages = await loadRecentConversationMessages(supabase, opts.conversationId);
  const result = inferDropoutReason({ messages, journeyStep: opts.journeyStep });

  await persistDropoutReason(supabase, {
    clinicId: opts.clinicId,
    patientId: opts.patientId,
    motivoProvavel: result.motivoProvavel,
    confianca: result.confianca,
    rationale: result.rationale,
    journeyStep: opts.journeyStep ?? null,
  });

  return result;
}
