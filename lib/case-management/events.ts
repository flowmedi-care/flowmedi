/**
 * Catálogo de Domain / Integration / Internal events (atômicos).
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
] as const;

export type InternalEventType = (typeof INTERNAL_EVENTS)[number];

export function isDomainEventType(t: string): t is DomainEventType {
  return (DOMAIN_EVENTS as readonly string[]).includes(t);
}

/** Outcomes que a IA pode publicar (AIPolicy default). */
export const AI_ALLOWED_DOMAIN_EVENTS: DomainEventType[] = [
  "Lead.Qualified",
  "Lead.Disqualified",
  "Conversation.Started",
  "Message.Received",
  "Handoff.Taken",
];
