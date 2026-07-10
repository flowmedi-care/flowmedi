export type SideEffect =
  | { type: "recordConsent"; patientId: string | null; clinicId: string; conversationId: string }
  | { type: "appendAudit"; record: TurnRecord }
  | { type: "enqueueOutbox"; event: OutboxEvent };

export type OutboxEvent = {
  name: string;
  payload: Record<string, unknown>;
};

export type TurnRecord = {
  conversationId: string;
  clinicId: string;
  turnId: string;
  inboundText: string;
  fsmStateBefore: string;
  fsmStateAfter: string;
  handlerDomain: string | null;
  replyPreview: string;
  timestamp: string;
};

export type ReplySpec =
  | { mode: "template"; templateId: string; vars?: Record<string, string> }
  | { mode: "literal"; text: string }
  | { mode: "draft"; templateId: string; vars?: Record<string, string> }
  | { mode: "silent" };

export type HandlerOutcome =
  | { type: "stay"; reply: ReplySpec; patch?: Record<string, unknown> }
  | { type: "advance"; reply: ReplySpec; patch?: Record<string, unknown> }
  | { type: "complete"; reply: ReplySpec }
  | { type: "fail"; reply: ReplySpec; recoverable: boolean };

export type FsmTransition = {
  fsmState: string;
  effects: SideEffect[];
  skipHandler?: boolean;
  reply?: ReplySpec;
};
