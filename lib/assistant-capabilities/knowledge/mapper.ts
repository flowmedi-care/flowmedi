import type { AppointmentPolicy } from "@/lib/attendance-flow/types";
import type { KnowledgeAclSettings } from "./types";
import { knowledgeAclDefaults } from "./types";

export function policyToKnowledgeAcl(policy: AppointmentPolicy): KnowledgeAclSettings {
  return policy.knowledge_acl ?? knowledgeAclDefaults();
}
