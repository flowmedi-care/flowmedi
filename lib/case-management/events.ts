/**
 * Catálogo de Domain / Integration / Internal events (atômicos).
 * AI Intents ≠ Domain Facts de módulo.
 */

export const DOMAIN_EVENTS = [
  "Appointment.Created",
  "Appointment.Confirmed",
  "Appointment.Completed",
  "Appointment.NoShow",
  "Appointment.Cancelled",
  "Payment.Created",
  "Payment.Paid",
  "Payment.PartiallyPaid",
  "PaymentRequested",
  "Lead.Qualified",
  "Lead.Disqualified",
  "Lead.Converted",
  "Form.Sent",
  "Form.Completed",
  "Conversation.Started",
  "Message.Received",
  "Handoff.Taken",
  "Booking.Requested",
  "Task.Created",
  "Task.Completed",
  "Owner.Changed",
  "Case.OverrideRequested",
  "Case.PhaseChanged",
  "Case.Opened",
  "Case.Closed",
  "PendingDecision.Set",
  "PendingDecision.Cleared",
  "NotificationRequested",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[number];

/** Intents / requests — IA e humano podem emitir. */
export const AI_INTENT_EVENTS = [
  "Conversation.Started",
  "Message.Received",
  "Handoff.Taken",
  "Booking.Requested",
  "Lead.Qualified",
  "PaymentRequested",
] as const;

export type AiIntentEventType = (typeof AI_INTENT_EVENTS)[number];

/** Facts que só o módulo dono emite — IA nunca. */
export const DOMAIN_FACT_EVENTS_BLOCKED_FOR_AI = [
  "Appointment.Created",
  "Appointment.Confirmed",
  "Appointment.Completed",
  "Appointment.NoShow",
  "Appointment.Cancelled",
  "Payment.Created",
  "Payment.Paid",
  "Payment.PartiallyPaid",
  "Lead.Converted",
  "Form.Sent",
  "Form.Completed",
  "Task.Created",
  "Task.Completed",
  "Case.PhaseChanged",
  "Case.Opened",
  "Case.Closed",
  "PendingDecision.Set",
  "PendingDecision.Cleared",
] as const;

export const INTEGRATION_EVENTS = [
  "Webhook.Outbound",
  "CRM.Sync",
  "Analytics.Export",
] as const;

export type IntegrationEventType = (typeof INTEGRATION_EVENTS)[number];

export const INTERNAL_EVENTS = [
  "Projection.Rebuilt",
  "Cache.Invalidated",
  "Notification.Delivered",
  "Automation.Applied",
  "Command.Rejected",
  "DomainEvent.Received",
  "Transition.Applied",
  "Transition.Skipped",
  "Policy.Evaluated",
  "Decision.Created",
  "Command.Applied",
  "Command.SkippedIdempotent",
  "Case.Updated",
] as const;

export type InternalEventType = (typeof INTERNAL_EVENTS)[number];

export function isDomainEventType(t: string): t is DomainEventType {
  return (DOMAIN_EVENTS as readonly string[]).includes(t);
}

export function isAiIntentEvent(t: string): boolean {
  return (AI_INTENT_EVENTS as readonly string[]).includes(t);
}

export function isDomainFactBlockedForAi(t: string): boolean {
  return (DOMAIN_FACT_EVENTS_BLOCKED_FOR_AI as readonly string[]).includes(t);
}

/** @deprecated use AI_INTENT_EVENTS — lista allow default da AI Policy */
export const AI_ALLOWED_DOMAIN_EVENTS: DomainEventType[] = [
  ...AI_INTENT_EVENTS,
] as DomainEventType[];
