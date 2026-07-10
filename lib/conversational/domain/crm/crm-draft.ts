export type CrmStep = "collect_contact" | "collect_interest";

export type CrmDraft = {
  step: CrmStep;
  name: string | null;
  phone: string | null;
  email: string | null;
  interest: string | null;
};

export function initialCrmDraft(): CrmDraft {
  return {
    step: "collect_contact",
    name: null,
    phone: null,
    email: null,
    interest: null,
  };
}

export function canAdvanceCrmDraft(draft: CrmDraft): boolean {
  if (draft.step === "collect_contact") {
    return Boolean(draft.name && (draft.phone || draft.email));
  }
  return Boolean(draft.interest);
}
