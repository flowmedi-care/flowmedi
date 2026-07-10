export type ConversationId = string;
export type ClinicId = string;
export type ExternalThreadId = string;

export function conversationId(value: string): ConversationId {
  return value;
}

export function clinicId(value: string): ClinicId {
  return value;
}

export function externalThreadId(value: string): ExternalThreadId {
  return value;
}
