export type PrimaryGoal =
  | "inform"
  | "book"
  | "price"
  | "crm"
  | "handoff"
  | "clarify"
  | "confirm"
  | "greet";

export type InfoNeed =
  | "what_we_do"
  | "pricing"
  | "availability"
  | "institutional"
  | "patient_history"
  | "general";

export type Understanding = {
  primaryGoal: PrimaryGoal;
  infoNeeds: InfoNeed[];
  entities: Record<string, string>;
  missingEntities: string[];
  menuReference: number | null;
  sentiment: "neutral" | "frustrated" | "positive";
  confidence: number;
  rawSummary: string;
};
