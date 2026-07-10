export type Goal = {
  id: string;
  type: string;
  target?: { kind: string; id?: string; name?: string };
  desiredNode: string;
};

export function newGoalId(): string {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
