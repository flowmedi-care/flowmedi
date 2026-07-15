export type KnowledgeSettings = {
  faqManagedElsewhere: true;
};

export function knowledgeDefaults(): KnowledgeSettings {
  return { faqManagedElsewhere: true };
}
