import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertWhatsappPipelineLead } from "@/lib/leads/upsert-whatsapp-lead";
import { setPendingDecision } from "./mutators";
import type { PendingDecision } from "./types";

export type OpsEventType =
  | "message_received"
  | "conversation_assigned"
  | "human_replied"
  | "ai_reactivated"
  | "appointment_created"
  | "patient_registered"
  | "pipeline_stage_changed"
  | "system_reminder_scheduled";

type BridgeBase = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
};

/**
 * Event Bridge: reage a decisões/eventos e atualiza estado via mutators / campos derivados.
 * Não contorna mutators para owner — só dispara efeitos colaterais CRM/pendingDecision.
 */
export async function emitOpsEvent(
  event: OpsEventType,
  input: BridgeBase & {
    phone?: string;
    contactName?: string | null;
    patientId?: string | null;
    appointmentId?: string | null;
    lifecycleStage?: string | null;
    reminderDueAt?: string | null;
  }
): Promise<void> {
  switch (event) {
    case "message_received": {
      if (input.phone) {
        const lead = await upsertWhatsappPipelineLead(input.supabase, {
          clinicId: input.clinicId,
          phone: input.phone,
          name: input.contactName,
        });
        if (lead.pipelineId) {
          await input.supabase
            .from("whatsapp_conversations")
            .update({
              pipeline_id: lead.pipelineId,
              // bump last contact via pipeline
            })
            .eq("id", input.conversationId)
            .eq("clinic_id", input.clinicId);

          await input.supabase
            .from("non_registered_pipeline")
            .update({
              last_contact_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead.pipelineId);
        }
      }
      break;
    }

    case "appointment_created": {
      const decision: PendingDecision = {
        type: "confirm_appointment",
        label: "Aguardar confirmação da consulta",
        owner: "patient_waiting",
        priority: "normal",
        dueAt: null,
        source: "appointment",
        status: "pending",
        actions: [
          { id: "open_agenda", label: "Ver agenda", kind: "navigate" },
        ],
      };
      await setPendingDecision({
        supabase: input.supabase,
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        decision,
      });
      if (input.patientId) {
        await input.supabase
          .from("non_registered_pipeline")
          .update({
            lifecycle_stage: "oportunidade",
            updated_at: new Date().toISOString(),
          })
          .eq("clinic_id", input.clinicId)
          .or(
            input.phone
              ? `phone.eq.${input.phone.replace(/\D/g, "")}`
              : `id.eq.00000000-0000-0000-0000-000000000000`
          );
      }
      break;
    }

    case "patient_registered": {
      const decision: PendingDecision = {
        type: "schedule_appointment",
        label: "Agendar primeira consulta",
        owner: "ai",
        priority: "normal",
        dueAt: null,
        source: "crm",
        status: "pending",
        actions: [
          { id: "schedule", label: "Agendar", kind: "schedule_appointment" },
        ],
      };
      await setPendingDecision({
        supabase: input.supabase,
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        decision,
      });
      break;
    }

    case "pipeline_stage_changed": {
      // Invalida journey_step_code no ai_state para o próximo turno reconstruir
      const { data: conv } = await input.supabase
        .from("whatsapp_conversations")
        .select("ai_state")
        .eq("id", input.conversationId)
        .maybeSingle();
      const state = { ...((conv?.ai_state as Record<string, unknown>) ?? {}) };
      delete state.journey_step_code;
      state.journey_invalidated_at = new Date().toISOString();
      if (input.lifecycleStage) {
        state.commercial_stage = input.lifecycleStage;
      }
      await input.supabase
        .from("whatsapp_conversations")
        .update({ ai_state: state })
        .eq("id", input.conversationId);
      break;
    }

    case "system_reminder_scheduled": {
      const decision: PendingDecision = {
        type: "callback_reminder",
        label: "Retornar contato (lembrete)",
        owner: "system",
        priority: "normal",
        dueAt: input.reminderDueAt ?? null,
        source: "system",
        status: "pending",
        actions: [
          { id: "call_now", label: "Contatar agora", kind: "contact" },
        ],
      };
      await setPendingDecision({
        supabase: input.supabase,
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        decision,
      });
      break;
    }

    default:
      break;
  }
}

/** Invalida journey no ai_state — usado por CRM edits. */
export async function invalidateAiJourneyState(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("clinic_id, ai_state")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return;
  await emitOpsEvent("pipeline_stage_changed", {
    supabase,
    clinicId: String(conv.clinic_id),
    conversationId,
  });
}

/**
 * Quando dueAt de lembrete sistema vence → devolve ao pool humano.
 * Chamado pelo cron de WhatsApp AI.
 */
export async function processDueSystemReminders(
  supabase: SupabaseClient,
  limit = 30
): Promise<number> {
  const { setOwner, setPendingDecision } = await import("./mutators");
  const nowIso = new Date().toISOString();

  const { data: rows } = await supabase
    .from("whatsapp_conversations")
    .select("id, clinic_id, pending_decision, ops_owner_type")
    .eq("ops_owner_type", "system")
    .not("pending_decision", "is", null)
    .limit(limit);

  let flipped = 0;
  for (const row of rows ?? []) {
    const decision = row.pending_decision as PendingDecision | null;
    if (!decision?.dueAt || decision.dueAt > nowIso) continue;
    if (decision.status && decision.status !== "pending" && decision.status !== "snoozed") {
      continue;
    }

    await setOwner({
      supabase,
      clinicId: row.clinic_id,
      conversationId: row.id,
      owner: "human",
      ownerUserId: null,
      clearAssignee: true,
      pauseAi: true,
      reason: "system_reminder_due",
    });

    await setPendingDecision({
      supabase,
      clinicId: row.clinic_id,
      conversationId: row.id,
      decision: {
        ...decision,
        owner: "human",
        status: "pending",
        label: decision.label || "Retornar contato (lembrete venceu)",
        actions: decision.actions?.length
          ? decision.actions
          : [{ id: "call_now", label: "Contatar agora", kind: "contact" }],
      },
    });
    flipped++;
  }
  return flipped;
}
