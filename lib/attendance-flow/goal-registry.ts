import type { CustomFieldForGoals, GoalDefinition, GoalPolicyLevel } from "./types";
import { BUILTIN_GOAL_DEFINITIONS } from "./defaults";

export function buildCustomFieldGoal(field: CustomFieldForGoals): GoalDefinition {
  return {
    id: `custom:${field.id}`,
    label: field.field_label,
    phase_id: "cadastro",
    completion: { type: "collected", key: `custom:${field.field_name}` },
    allowed_tools: ["update_patient_intake"],
    prompt_hint: `Colete o campo "${field.field_label}".`,
    priority: 55 + Math.min(field.display_order, 20),
    default_policy: field.whatsapp_policy,
  };
}

export class GoalRegistry {
  private goals = new Map<string, GoalDefinition>();

  constructor(initial?: GoalDefinition[]) {
    for (const g of initial ?? BUILTIN_GOAL_DEFINITIONS) {
      this.goals.set(g.id, g);
    }
  }

  register(goal: GoalDefinition): void {
    this.goals.set(goal.id, goal);
  }

  registerCustomFields(fields: CustomFieldForGoals[]): void {
    for (const f of fields) {
      if (f.whatsapp_policy === "ignore") {
        this.goals.delete(`custom:${f.id}`);
        continue;
      }
      this.register(buildCustomFieldGoal(f));
    }
  }

  get(id: string): GoalDefinition | undefined {
    return this.goals.get(id);
  }

  getAll(): GoalDefinition[] {
    return Array.from(this.goals.values());
  }

  getForWorkflow(goalIds: string[]): GoalDefinition[] {
    return goalIds
      .map((id) => this.goals.get(id))
      .filter((g): g is GoalDefinition => g != null);
  }

  resolvePolicy(
    goalId: string,
    clinicPolicy: Record<string, GoalPolicyLevel>
  ): GoalPolicyLevel {
    if (clinicPolicy[goalId]) return clinicPolicy[goalId];
    const goal = this.goals.get(goalId);
    return goal?.default_policy ?? "optional";
  }
}

export const defaultGoalRegistry = new GoalRegistry();
