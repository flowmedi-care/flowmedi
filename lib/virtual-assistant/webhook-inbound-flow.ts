import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleConfirmationFlowInbound,
  type ParsedFlowInbound,
} from "./confirmation-flow-handler";
import { logAiEvent } from "./event-log";

/**
 * Processa resposta de WhatsApp Flow / botão de confirmação antes da fila da IA.
 */
export async function tryHandleInboundConfirmationFlow(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    messageId?: string;
    flowInbound: ParsedFlowInbound | null;
  }
): Promise<{ handled: boolean; scheduleAi?: boolean }> {
  if (!opts.flowInbound) return { handled: false };

  const result = await handleConfirmationFlowInbound(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    phoneNumber: opts.phoneNumber,
    parsed: opts.flowInbound,
    messageId: opts.messageId,
  });

  if (!result.handled) return { handled: false };

  logAiEvent(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    messageId: opts.messageId,
    stage: "confirmation_flow_handled",
    detail: {
      action: opts.flowInbound.action,
      scheduleAi: result.scheduleAi ?? false,
    },
  });

  return { handled: true, scheduleAi: result.scheduleAi };
}
