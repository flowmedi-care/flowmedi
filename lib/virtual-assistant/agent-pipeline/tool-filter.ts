import type { ToolDefinition } from "../openai-client";
import { ASSISTANT_TOOLS } from "../tools/definitions";
import { MUTATING_TOOL_NAMES, TRANSVERSAL_TOOL_NAMES } from "./constants";
import {
  type AgentPipelineStage,
  AGENT_PIPELINE_STAGE_MAP,
  getStageDefinition,
} from "./stages";

const TOOL_BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.function.name, t]));

export type FilterToolsInput = {
  mainStage: AgentPipelineStage;
  parallelStages?: AgentPipelineStage[];
  /** Incluir get_payment_status mesmo fora da etapa financeiro */
  includeFinanceRead?: boolean;
};

export function collectAllowedToolNames(input: FilterToolsInput): string[] {
  const stages = [input.mainStage, ...(input.parallelStages ?? [])];
  const names = new Set<string>();

  for (const stage of stages) {
    const def = getStageDefinition(stage);
    for (const t of def.readTools) names.add(t);
    for (const t of def.mutatingTools) names.add(t);
  }

  for (const t of TRANSVERSAL_TOOL_NAMES) names.add(t);

  if (input.includeFinanceRead) {
    names.add("get_payment_status");
  }

  return [...names];
}

export function filterToolsForStage(input: FilterToolsInput): ToolDefinition[] {
  const allowed = new Set(collectAllowedToolNames(input));
  return ASSISTANT_TOOLS.filter((t) => allowed.has(t.function.name));
}

export function isToolAllowedInStage(toolName: string, input: FilterToolsInput): boolean {
  return collectAllowedToolNames(input).includes(toolName);
}

export function isMutatingTool(toolName: string): boolean {
  return (MUTATING_TOOL_NAMES as readonly string[]).includes(toolName);
}

export function getStageForTool(
  toolName: string
): AgentPipelineStage | "transversal" | null {
  if ((TRANSVERSAL_TOOL_NAMES as readonly string[]).includes(toolName)) {
    return "transversal";
  }
  for (const [code, def] of AGENT_PIPELINE_STAGE_MAP) {
    if (def.readTools.includes(toolName) || def.mutatingTools.includes(toolName)) {
      return code;
    }
  }
  return null;
}

export function getToolDefinitionByName(name: string): ToolDefinition | undefined {
  return TOOL_BY_NAME.get(name);
}
