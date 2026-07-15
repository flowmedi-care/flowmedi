import type { AppointmentPolicy } from "@/lib/attendance-flow/types";
import type { ConversationFlowsConfig } from "@/lib/attendance-flow/types";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import {
  mergeFinanceActions,
  mergeKnowledgeAcl,
  resolveAllowedToolNames,
  resolveEnabledCapabilities,
} from "@/lib/assistant-platform";

/**
 * Hard-gate tools already selected by the attendance flow against Information ACL + finance actions.
 */
export function applyPlatformToolGate(input: {
  toolNames: string[];
  appointmentPolicy: AppointmentPolicy;
  conversationFlows: ConversationFlowsConfig;
  vaSettings: Partial<VirtualAssistantSettings>;
}): string[] {
  const acl = mergeKnowledgeAcl(input.appointmentPolicy.knowledge_acl);
  const finance = mergeFinanceActions(input.appointmentPolicy.finance_actions);
  const consulta = input.conversationFlows.workflows.consulta;
  const cancelamento = input.conversationFlows.workflows.cancelamento;
  const reschedule = input.conversationFlows.workflows.reschedule;

  const capabilities = resolveEnabledCapabilities({
    knowledgeAcl: acl,
    financeActions: finance,
    allowBooking: consulta?.enabled !== false,
    allowCancel: cancelamento?.enabled !== false,
    allowReschedule: reschedule?.enabled !== false,
    checkInEnabled: input.appointmentPolicy.check_in.enabled,
    humanHandoffEnabled: input.vaSettings.human_handoff_enabled !== false,
  });

  return resolveAllowedToolNames({
    toolNames: input.toolNames,
    capabilities,
    knowledgeAcl: acl,
    financeActions: finance,
  });
}
