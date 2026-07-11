/** Política de atendimento por goal (Configurações da Clínica). */
export type GoalPolicyLevel = "ignore" | "optional" | "required";

export type AppointmentPolicy = {
  goals: Record<string, GoalPolicyLevel>;
};

export type WorkflowMode = "express" | "assisted" | "strict";

export type GoalConditionOperator = "eq" | "neq" | "exists" | "lt" | "gt";

export type GoalCondition = {
  field: string;
  operator: GoalConditionOperator;
  value?: unknown;
};

export type GoalCompletion =
  | { type: "state_path"; path: string }
  | { type: "collected"; key: string }
  | { type: "mutation"; key: string }
  | { type: "custom"; resolver: string };

export type GoalDefinition = {
  id: string;
  label: string;
  phase_id?: string;
  completion: GoalCompletion;
  when?: GoalCondition[];
  allowed_tools: string[];
  prompt_hint: string;
  priority: number;
  default_policy?: GoalPolicyLevel;
  requires_confirmation?: boolean;
  is_mutation?: boolean;
};

export type FlowPhaseUI = {
  id: string;
  label: string;
  goal_ids: string[];
};

export type WorkflowDefinition = {
  id: string;
  label: string;
  mode: WorkflowMode;
  goal_ids: string[];
  phases?: FlowPhaseUI[];
  priority_overrides?: Record<string, number>;
  enabled: boolean;
};

export type ConversationFlowsConfig = {
  workflows: Record<string, WorkflowDefinition>;
};

export type ConversationFlowState = {
  active_workflow_id: string;
  mode: WorkflowMode;
  satisfied: string[];
  pending: string[];
  collected: Record<string, unknown>;
  focus_goal_id?: string;
  pending_confirmation?: {
    goal_id: string;
    tool: string;
    args: Record<string, unknown>;
  };
  mutation_done?: Record<string, boolean>;
};

export type IntentResolution = {
  workflow_id: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type GoalEvaluationContext = {
  aiState: Record<string, unknown>;
  collected: Record<string, unknown>;
  patient?: Record<string, unknown> | null;
  mutation_done?: Record<string, boolean>;
};

export type IntakePendency = {
  goal_id: string;
  label: string;
  required: boolean;
};

export type CustomFieldForGoals = {
  id: string;
  field_name: string;
  field_label: string;
  whatsapp_policy: GoalPolicyLevel;
  display_order: number;
};
