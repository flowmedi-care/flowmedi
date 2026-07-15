import type { KnowledgeAcl } from "../knowledge-acl";
import { aclFieldEnabled, sourceEnabled } from "../knowledge-acl";
import type { FinanceActions } from "../finance-actions";
import {
  type ResolvedCapabilities,
  type RuntimeCapabilityId,
  isCapabilityEnabled,
} from "../capabilities/definitions";

export type ToolDependency = {
  name: string;
  /** OR: at least one capability must be enabled (empty = no cap check) */
  requiresCapabilities?: RuntimeCapabilityId[];
  requiresSources?: Array<"clinic" | "procedures" | "services" | "knowledge_base">;
  requiresAclFields?: string[];
  requiresFinanceAction?: keyof FinanceActions;
};

export const TOOL_DEPENDENCIES: ToolDependency[] = [
  {
    name: "list_procedures",
    requiresSources: ["procedures"],
    requiresAclFields: ["procedures.list"],
  },
  {
    name: "get_procedure_info",
    requiresCapabilities: ["procedure_information"],
    requiresSources: ["procedures"],
  },
  {
    name: "list_services",
    requiresCapabilities: ["service_information"],
    requiresSources: ["services"],
    requiresAclFields: ["services.list"],
  },
  {
    name: "get_service_price",
    requiresCapabilities: ["pricing"],
    requiresSources: ["services"],
    requiresAclFields: ["services.showPrices"],
  },
  {
    name: "list_price_options",
    requiresCapabilities: ["pricing"],
    requiresSources: ["services"],
    requiresAclFields: ["services.showPrices"],
  },
  {
    name: "search_faq",
    requiresCapabilities: ["knowledge_base"],
    requiresSources: ["knowledge_base"],
  },
  {
    name: "resolve_quote_offer",
    requiresCapabilities: ["quote"],
    requiresFinanceAction: "allowGenerateQuote",
  },
  {
    name: "create_and_send_quote",
    requiresCapabilities: ["quote"],
    requiresFinanceAction: "allowSendQuote",
  },
  {
    name: "get_quote_status",
    requiresCapabilities: ["quote"],
  },
  {
    name: "transfer_to_human",
    requiresCapabilities: ["handoff"],
  },
  {
    name: "check_in_appointment",
    requiresCapabilities: ["check_in"],
  },
];

const DEP_BY_NAME = new Map(TOOL_DEPENDENCIES.map((d) => [d.name, d]));

export function resolveAllowedToolNames(input: {
  toolNames: string[];
  capabilities: ResolvedCapabilities;
  knowledgeAcl: KnowledgeAcl;
  financeActions: FinanceActions;
}): string[] {
  return input.toolNames.filter((name) =>
    isToolAllowed(name, input.capabilities, input.knowledgeAcl, input.financeActions)
  );
}

export function isToolAllowed(
  toolName: string,
  capabilities: ResolvedCapabilities,
  knowledgeAcl: KnowledgeAcl,
  financeActions: FinanceActions
): boolean {
  const dep = DEP_BY_NAME.get(toolName);
  if (!dep) return true;

  if (dep.requiresCapabilities?.length) {
    const ok = dep.requiresCapabilities.some((c) => isCapabilityEnabled(capabilities, c));
    if (!ok) return false;
  }

  if (dep.requiresSources) {
    for (const src of dep.requiresSources) {
      if (!sourceEnabled(knowledgeAcl, src)) return false;
    }
  }

  if (dep.requiresAclFields) {
    for (const path of dep.requiresAclFields) {
      if (!aclFieldEnabled(knowledgeAcl, path)) return false;
    }
  }

  if (dep.requiresFinanceAction && !financeActions[dep.requiresFinanceAction]) {
    return false;
  }

  return true;
}
