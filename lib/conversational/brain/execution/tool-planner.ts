import type { ToolStep } from "../types/turn-plan";

/** Agrupa steps em ondas: cada onda só depende de ondas anteriores. */
export function groupToolStepsIntoWaves(steps: ToolStep[]): ToolStep[][] {
  if (!steps.length) return [];

  const pending = new Map(steps.map((s) => [s.id, s]));
  const done = new Set<string>();
  const waves: ToolStep[][] = [];

  while (pending.size > 0) {
    const ready = [...pending.values()].filter(
      (s) => !s.dependsOn?.length || s.dependsOn.every((d) => done.has(d))
    );
    if (!ready.length) {
      waves.push([...pending.values()]);
      break;
    }
    waves.push(ready);
    for (const step of ready) {
      pending.delete(step.id);
      done.add(step.id);
    }
  }

  return waves;
}
