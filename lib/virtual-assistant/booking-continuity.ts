import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeOfferedBookingState } from "@/lib/booking-state";
import { getClinicTimezone } from "@/lib/clinic-timezone";
import { tryExecuteBookingSlotSelection } from "@/lib/operational-agents/booking-executor";
import type { InboundIntent } from "./detect-inbound-intent";
import type { AiConversationState } from "./types";
import {
  applyBookingContinuityStatePatch,
  hasActiveBookingContext,
  hasOfferedBookingSelection,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "./booking-continuity-guards";

export {
  applyBookingContinuityStatePatch,
  hasActiveBookingContext,
  hasOfferedBookingSelection,
  resolveContinuityIntent,
  shouldContinueBookingFlow,
} from "./booking-continuity-guards";

export type BookingContinuityResult =
  | {
      handled: true;
      reply: string;
      statePatch: AiConversationState;
    }
  | { handled: false; aiState: AiConversationState };

export async function tryBookingContinuityReply(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    messageText: string;
    aiState: AiConversationState;
    detectedIntent: InboundIntent;
  }
): Promise<BookingContinuityResult> {
  const { messageText, detectedIntent } = opts;

  if (!shouldContinueBookingFlow(messageText, detectedIntent, opts.aiState)) {
    return { handled: false, aiState: opts.aiState };
  }

  const clinicTz = await getClinicTimezone(supabase, opts.clinicId);
  let aiState = applyBookingContinuityStatePatch({
    ...opts.aiState,
    ...sanitizeOfferedBookingState(opts.aiState, clinicTz),
  });

  const slotExec = await tryExecuteBookingSlotSelection(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    phoneNumber: opts.phoneNumber,
    messageText,
    aiState,
  });

  if (slotExec.handled) {
    return {
      handled: true,
      reply: slotExec.reply,
      statePatch: { ...aiState, ...slotExec.statePatch },
    };
  }

  return { handled: false, aiState };
}
