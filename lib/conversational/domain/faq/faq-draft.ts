export type FaqDraft = {
  lastQuery: string | null;
  lastAnswerId: string | null;
  /** Transient discovery listing (maps to discovery.present FSM state). */
  discoveryMode?: boolean;
};

export function initialFaqDraft(): FaqDraft {
  return {
    lastQuery: null,
    lastAnswerId: null,
  };
}
