import type { ToolName } from "../../tools/registry";
import type { PrimaryGoal } from "./understanding";

export type ToolStep = {
  id: string;
  tool: ToolName | "list_procedures" | "find_available_slots" | "get_service_price" | "list_price_options" | "get_contact_journey" | "lookup_patient";
  args: Record<string, unknown>;
  resolvedArgs?: Record<string, unknown>;
  dependsOn?: string[];
  parallelizable: boolean;
  purpose: string;
};

export type TurnPlan = {
  primaryGoal: PrimaryGoal;
  subGoals: string[];
  toolSteps: ToolStep[];
  clarify?: string;
  handoff?: boolean;
  confidence: number;
  source: "template" | "llm" | "replan";
};
