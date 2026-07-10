import { Conversation } from "../../domain/conversation/conversation";
import { patientRef } from "../../domain/shared/patient-ref";
import type { Intent } from "../../domain/shared/intent";
import { isIntent } from "../../domain/shared/intent";
import type { ConversationSnapshot } from "./conversation-snapshot";
import { conversationSnapshotSchema } from "./conversation-snapshot";

export class ConversationMapper {
  static toDomain(snapshot: ConversationSnapshot): Conversation {
    const validated = conversationSnapshotSchema.parse(snapshot);
    const deferredIntent =
      validated.consent.deferredIntent && isIntent(validated.consent.deferredIntent)
        ? (validated.consent.deferredIntent as Intent)
        : null;

    return Conversation.create({
      id: validated.conversationId,
      clinicId: validated.clinicId,
      channel: validated.channel,
      externalThreadId: validated.externalThreadId,
      status: validated.status,
      patientRef: validated.patientId ? patientRef(validated.patientId) : null,
      consent: {
        status: validated.consent.status,
        deferredIntent,
        recordedAt: validated.consent.recordedAt,
      },
      handoff:
        validated.handoffTicketId && validated.handoffStartedAt
          ? {
              ticketId: validated.handoffTicketId,
              startedAt: validated.handoffStartedAt,
            }
          : null,
      activeFlow: validated.activeFlow,
      version: validated.version,
      lastUserMessageAt: validated.lastUserMessageAt,
    });
  }

  static toSnapshot(conversation: Conversation): ConversationSnapshot {
    const props = conversation.toProps();
    return {
      conversationId: props.id,
      clinicId: props.clinicId,
      channel: props.channel,
      externalThreadId: props.externalThreadId,
      status: props.status,
      patientId: props.patientRef?.id ?? null,
      consent: {
        status: props.consent.status,
        deferredIntent: props.consent.deferredIntent,
        recordedAt: props.consent.recordedAt,
      },
      handoffTicketId: props.handoff?.ticketId ?? null,
      handoffStartedAt: props.handoff?.startedAt ?? null,
      activeFlow: props.activeFlow,
      version: props.version,
      lastUserMessageAt: props.lastUserMessageAt,
    };
  }
}
