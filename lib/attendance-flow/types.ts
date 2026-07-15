/** Política de atendimento por goal (Configurações da Clínica). */
export type GoalPolicyLevel = "ignore" | "optional" | "required";

/** Presence check-in (WhatsApp / channels) — not workflow.enabled. */
export type CheckInPolicy = {
  enabled: boolean;
  window: {
    opens_before_hours: number;
    closes_after_minutes: number;
  };
};

/** Partial input for stored clinic JSON / merge. */
export type CheckInPolicyInput = {
  enabled?: boolean;
  window?: {
    opens_before_hours?: number;
    closes_after_minutes?: number;
  };
};

export type AppointmentPolicy = {
  goals: Record<string, GoalPolicyLevel>;
  check_in: CheckInPolicy;
};

export type AppointmentPolicyInput = {
  goals?: Record<string, GoalPolicyLevel>;
  check_in?: CheckInPolicyInput;
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
  | { type: "patient_or_collected"; key: string; patientKey?: string }
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
  /**
   * When this goal must be satisfied relative to booking create.
   * before_booking + policy required → blocks create_appointment.
   * after_booking → never blocks create; collect post-booking.
   */
  requiredStage?: "before_booking" | "after_booking" | "optional";
  requires_confirmation?: boolean;
  is_mutation?: boolean;
};

export type FlowPhaseUI = {
  id: string;
  label: string;
  goal_ids: string[];
};

export type WorkflowRuntimeMetadata = {
  /**
   * Metadata only — never behavior (no reset()/execute()/interpreter() functions).
   * Engine reads this to reset Current Operation after a successful mutation with remaining targets.
   */
  resetSpec?: {
    mutationKeys: string[];
    collectedKeys?: string[];
  };
  /** Future metadata slots: timeout, retryPolicy, etc. */
};

export type WorkflowDefinition = {
  id: string;
  label: string;
  mode: WorkflowMode;
  goal_ids: string[];
  phases?: FlowPhaseUI[];
  priority_overrides?: Record<string, number>;
  enabled: boolean;
  /** Runtime metadata only — never executable behavior on the definition. */
  runtime?: WorkflowRuntimeMetadata;
};

export type ConversationFlowsConfig = {
  workflows: Record<string, WorkflowDefinition>;
};

/** Engine lifecycle for the Current Operation (not domain mutation status). */
export type CurrentOperationStatus = "active" | "completed";

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
  /** Engine status of the Current Operation. Closed ops are not re-evaluated by sync. */
  current_operation?: {
    status: CurrentOperationStatus;
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
  turnFacts?: Record<string, unknown>;
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
