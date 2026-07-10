export type DomainEvent =
  | { type: "ConsentGranted"; conversationId: string; clinicId: string; patientId?: string }
  | { type: "ConsentDenied"; conversationId: string; clinicId: string }
  | { type: "BookingFlowStarted"; conversationId: string; mode: string }
  | { type: "BookingFlowCompleted"; conversationId: string; summary: string }
  | { type: "HandoffRequested"; conversationId: string; ticketId: string }
  | { type: "ConversationClosed"; conversationId: string };

export type DomainEventCollector = DomainEvent[];

export function collectEvent(
  events: DomainEventCollector,
  event: DomainEvent
): DomainEventCollector {
  events.push(event);
  return events;
}
