import type { Conversation } from "../../domain/conversation/conversation";
import type { ClinicConfig } from "../../clinic/clinic-config";
import type { ToolGateway } from "../../tools/gateway";
import type { HandlerOutcome, ReplySpec } from "../../fsm/side-effects";
import type { ResolvedInput } from "../../fsm/resolved-input";

export type HandlerContext = {
  conversation: Conversation;
  config: ClinicConfig;
  input: ResolvedInput;
  tools: ToolGateway;
  turnId: string;
  phoneNumber: string;
};

export interface DomainHandler {
  handle(ctx: HandlerContext): Promise<HandlerOutcome>;
}

export function literalReply(text: string): ReplySpec {
  return { mode: "literal", text };
}

export function templateReply(templateId: string, vars?: Record<string, string>): ReplySpec {
  return { mode: "template", templateId, vars };
}
