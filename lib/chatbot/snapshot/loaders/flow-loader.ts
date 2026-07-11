import type { ConversationFlowsConfig } from "@/lib/attendance-flow/types";
import type { PolicySlice } from "./policy-loader";

export type FlowSlice = {
  conversationFlows: ConversationFlowsConfig;
};

export function loadFlowSlice(policy: PolicySlice): FlowSlice {
  return { conversationFlows: policy.conversationFlows };
}
