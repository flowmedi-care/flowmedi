/** Facts observable in user text or resolvable against offered_* lists. No inference. */
export type NormalizedFacts = {
  date?: string;
  period?: "manha" | "tarde";
  selectedIndex?: number;
  confirmed?: boolean;
  ordinal?: number;
  entityId?: string;
};
