export type Goal = {
  id: string;
  type: string;
  target?: { kind: string; id?: string; name?: string };
  desiredNode: string;
};

/** Futuro: goals compostos AND/OR sem mudar a API do Reasoner. */
export type GoalGraph = {
  operator: "AND" | "OR";
  nodes: string[];
};

export function newGoalId(): string {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
