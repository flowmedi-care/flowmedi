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

/** Names match CHATBOT_TOOLS / execute.ts */
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
    name: "get_service_price",
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
    name: "transfer_to_human",
    requiresCapabilities: ["handoff"],
  },
  {
    name: "perform_check_in",
    requiresCapabilities: ["check_in"],
  },
  {
    name: "lookup_patient_by_phone",
    requiresCapabilities: ["patient_lookup"],
  },
  {
    name: "register_patient",
    requiresCapabilities: ["patient_lookup"],
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
