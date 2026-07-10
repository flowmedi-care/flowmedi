export type EntityStatus = "known" | "suspected" | "missing" | "invalid";

export type StateTransition = {
  entity: string;
  from: EntityStatus;
  to: EntityStatus;
};
