import type { KnowledgeAcl } from "@/lib/assistant-platform/knowledge-acl";
import { defaultKnowledgeAcl } from "@/lib/assistant-platform/knowledge-acl";

export type KnowledgeAclSettings = KnowledgeAcl;

export function knowledgeAclDefaults(): KnowledgeAclSettings {
  return defaultKnowledgeAcl();
}
