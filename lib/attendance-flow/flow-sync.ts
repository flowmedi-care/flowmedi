import type { AiState } from "@/lib/chatbot/state/types";
import {
  mergeAppointmentPolicy,
  mergeConversationFlows,
  DEFAULT_WORKFLOW_CONSULTA,
} from "./defaults";
import {
  buildGoalPromptBlock,
  resolveAvailableTools,
  getWorkflowFromConfig,
  initConversationFlowState,
  syncFlowState,
  type EngineInput,
} from "./engine";
import { defaultGoalRegistry, GoalRegistry } from "./goal-registry";
import { resolveIntent, shouldSwitchWorkflow } from "./intent-resolver";
import type {
  AppointmentPolicy,
  AppointmentPolicyInput,
  ConversationFlowsConfig,
  ConversationFlowState,
  CustomFieldForGoals,
} from "./types";

export type ClinicFlowConfig = {
  appointmentPolicy: AppointmentPolicy;
  conversationFlows: ConversationFlowsConfig;
  customFields?: CustomFieldForGoals[];
};

export function buildGoalRegistry(customFields?: CustomFieldForGoals[]): GoalRegistry {
  const registry = new GoalRegistry();
  if (customFields?.length) {
    registry.registerCustomFields(customFields);
  }
  return registry;
}

export function mergeClinicFlowConfig(raw: {
  appointment_policy?: AppointmentPolicyInput | null;
  conversation_flows?: Partial<ConversationFlowsConfig> | null;
}): ClinicFlowConfig {
  return {
    appointmentPolicy: mergeAppointmentPolicy(raw.appointment_policy),
    conversationFlows: mergeConversationFlows(raw.conversation_flows),
  };
}

export function ensureConversationFlow(
  aiState: AiState,
  config: ClinicFlowConfig,
  workflowId?: string
): ConversationFlowState {
  const wfId = workflowId ?? aiState.conversation_flow?.active_workflow_id ?? "consulta";
  const workflow =
    getWorkflowFromConfig(config.conversationFlows, wfId) ?? DEFAULT_WORKFLOW_CONSULTA;

  if (!aiState.conversation_flow) {
    return initConversationFlowState(workflow);
  }

  return {
    ...aiState.conversation_flow,
    active_workflow_id: workflow.id,
    mode: workflow.mode,
    collected: aiState.conversation_flow.collected ?? {},
    satisfied: aiState.conversation_flow.satisfied ?? [],
    pending: aiState.conversation_flow.pending ?? [],
    mutation_done: aiState.conversation_flow.mutation_done ?? {},
  };
}

export type FlowSyncResult = {
  aiStatePatch: Partial<AiState>;
  flowBlock: string;
  allowedTools: string[];
  registry: GoalRegistry;
  engineInput: EngineInput;
};

export function syncConversationFlowTurn(
  aiState: AiState,
  userText: string,
  config: ClinicFlowConfig,
  customFields?: CustomFieldForGoals[],
  patient?: Record<string, unknown> | null,
  turnFacts?: Record<string, unknown>
): FlowSyncResult {
  const registry = buildGoalRegistry(customFields);
  const intent = resolveIntent({ userText, aiState });

  let workflowId = aiState.conversation_flow?.active_workflow_id ?? "consulta";
  if (shouldSwitchWorkflow(workflowId, intent)) {
    workflowId = intent.workflow_id;
  }

  const workflow =
    getWorkflowFromConfig(config.conversationFlows, workflowId) ?? DEFAULT_WORKFLOW_CONSULTA;

  let flowState = ensureConversationFlow(aiState, config, workflow.id);

  if (shouldSwitchWorkflow(aiState.conversation_flow?.active_workflow_id, intent)) {
    flowState = initConversationFlowState(workflow);
  }

  const engineInput: EngineInput = {
    workflow,
    policy: config.appointmentPolicy,
    registry,
    aiState,
    flowState,
    patient: patient ?? undefined,
    turnFacts,
  };

  const synced = syncFlowState(engineInput);
  engineInput.flowState = synced;

  const allowedTools = resolveAvailableTools(engineInput);
  const flowBlock = buildGoalPromptBlock(engineInput);

  return {
    aiStatePatch: { conversation_flow: synced },
    flowBlock,
    allowedTools,
    registry,
    engineInput,
  };
}

export function patchCollectedFromArgs(
  flowState: ConversationFlowState,
  fields: Record<string, unknown>
): ConversationFlowState {
  const collected = { ...flowState.collected };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== "") {
      collected[k] = v;
    }
  }
  return { ...flowState, collected };
}

export { defaultGoalRegistry };
