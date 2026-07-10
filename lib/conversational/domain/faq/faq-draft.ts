export type FaqDraft = {
  lastQuery: string | null;
  lastAnswerId: string | null;
};

export function initialFaqDraft(): FaqDraft {
  return {
    lastQuery: null,
    lastAnswerId: null,
  };
}
