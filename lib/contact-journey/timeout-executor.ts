import type { SupabaseClient } from "@supabase/supabase-js";
import { getStepMetadata } from "./step-metadata";
import {
  getTimeoutPolicy,
  getExhaustedAction,
  listTimeoutPolicySteps,
  shouldEscalateAfterFollowups,
  type TimeoutAction,
} from "./timeout-policy";
import type { JourneyStepCode } from "./types";
import { inferAndPersistDropoutForConversation } from "./dropout-inference";
import {
  isCommercialFollowupStep,
  sendCommercialFollowup,
} from "@/lib/virtual-assistant/commercial-followup";
import { isInsideAutoMessageWindow } from "@/lib/whatsapp-ops-controls";
import { isVirtualAssistantActive } from "@/lib/virtual-assistant/process-inbound";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";

export type TimeoutExecutorResult = {
  processed: number;
  followupsSent: number;
  exhausted: number;
  errors: number;
};

type ConversationRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  ai_state: AiConversationState | null;
  ai_last_processed_message_at: string | null;
};

function getFollowupCount(state: AiConversationState, step: JourneyStepCode): number {
  const map = state.timeout_followup_counts ?? {};
  return map[step] ?? 0;
}

function bumpFollowupCount(
  state: AiConversationState,
  step: JourneyStepCode
): AiConversationState {
  const map = { ...(state.timeout_followup_counts ?? {}) };
  map[step] = (map[step] ?? 0) + 1;
  return { ...state, timeout_followup_counts: map };
}

async function getHoursSinceLastOutbound(
  supabase: SupabaseClient,
  conversationId: string
): Promise<number> {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return Infinity;
  return (Date.now() - new Date(data.created_at).getTime()) / (60 * 60 * 1000);
}

async function executeExhaustedAction(
  supabase: SupabaseClient,
  action: TimeoutAction,
  row: ConversationRow,
  step: JourneyStepCode,
  pipelineTransition?: AgentPipelineStage
): Promise<void> {
  const state = row.ai_state ?? {};
  const patientId = state.patient_id;

  if (action === "transition_pipeline" && pipelineTransition) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        ai_state: {
          ...state,
          pipeline_stage: pipelineTransition,
          pipeline_stage_entered_at: new Date().toISOString(),
          journey_step_code: step === "orcamento_enviado" ? "orcamento_vencido" : state.journey_step_code,
        },
      })
      .eq("id", row.id);
    return;
  }

  if (action === "escalate") {
    await supabase
      .from("whatsapp_conversations")
      .update({
        ai_state: { ...state, intent: "human_handoff" },
        ai_handoff_at: new Date().toISOString(),
        ai_enabled: false,
      })
      .eq("id", row.id);
    return;
  }

  if (action === "archive" && patientId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("clinic_id", row.clinic_id)
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();
    if (lead?.id) {
      await supabase
        .from("leads")
        .update({ lifecycle_stage: "perdido", updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
    return;
  }

  // reengage fallback — handled before exhausted in main loop
}

export async function runContactJourneyTimeouts(
  supabase: SupabaseClient,
  clinicIdFilter?: string
): Promise<TimeoutExecutorResult> {
  const result: TimeoutExecutorResult = {
    processed: 0,
    followupsSent: 0,
    exhausted: 0,
    errors: 0,
  };

  const steps = listTimeoutPolicySteps().filter((s) => getStepMetadata(s).awaitsResponse);

  let clinicsQuery = supabase.from("clinic_virtual_assistant_settings").select("clinic_id").eq("enabled", true);
  if (clinicIdFilter) clinicsQuery = clinicsQuery.eq("clinic_id", clinicIdFilter);
  const { data: clinics } = await clinicsQuery;
  if (!clinics?.length) return result;

  for (const { clinic_id: clinicId } of clinics) {
    const { active } = await isVirtualAssistantActive(supabase, clinicId);
    if (!active) continue;
    if (!(await isInsideAutoMessageWindow(clinicId, supabase))) continue;

    for (const step of steps) {
      const policy = getTimeoutPolicy(step);
      if (!policy) continue;

      const { data: conversations } = await supabase
        .from("whatsapp_conversations")
        .select("id, clinic_id, phone_number, ai_state, ai_last_processed_message_at")
        .eq("clinic_id", clinicId)
        .filter("ai_state->>journey_step_code", "eq", step)
        .limit(100);

      for (const row of (conversations ?? []) as ConversationRow[]) {
        result.processed++;
        const state = row.ai_state ?? {};
        const followupCount = getFollowupCount(state, step);
        const hoursSince = await getHoursSinceLastOutbound(supabase, row.id);
        const threshold = policy.followupHours[followupCount];

        if (threshold === undefined || hoursSince < threshold) continue;

        try {
          if (patientIdFromState(state)) {
            await inferAndPersistDropoutForConversation(supabase, {
              clinicId,
              conversationId: row.id,
              patientId: state.patient_id,
              journeyStep: step,
            });
          }

          if (shouldEscalateAfterFollowups(step, followupCount)) {
            await executeExhaustedAction(
              supabase,
              getExhaustedAction(step),
              row,
              step,
              policy.pipelineTransition
            );
            result.exhausted++;
            continue;
          }

          if (state.patient_id && isCommercialFollowupStep(step)) {
            const res = await sendCommercialFollowup(supabase, {
              clinicId,
              conversationId: row.id,
              phoneNumber: row.phone_number,
              patientId: state.patient_id,
              journeyStep: step,
            });
            if (res.success) {
              await supabase
                .from("whatsapp_conversations")
                .update({ ai_state: bumpFollowupCount(state, step) })
                .eq("id", row.id);
              result.followupsSent++;
            } else {
              result.errors++;
            }
          } else {
            const { sendAssistantReply } = await import("@/lib/virtual-assistant/send-reply");
            await sendAssistantReply(
              supabase,
              clinicId,
              row.id,
              row.phone_number,
              "Olá! Passando para saber se posso ajudar com algo. Quando puder, responda esta mensagem."
            );
            await supabase
              .from("whatsapp_conversations")
              .update({ ai_state: bumpFollowupCount(state, step) })
              .eq("id", row.id);
            result.followupsSent++;
          }
        } catch {
          result.errors++;
        }
      }
    }
  }

  return result;
}

function patientIdFromState(state: AiConversationState): state is AiConversationState & { patient_id: string } {
  return typeof state.patient_id === "string" && state.patient_id.length > 0;
}
