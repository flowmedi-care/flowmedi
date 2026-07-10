import type { PerceivedFacts } from "../../perception/perception";
import type { OperationalMemory } from "../../types/memory";

export type MergedInput = {
  perceived: PerceivedFacts;
  memory: OperationalMemory;
};

export function mergeMemory(
  perceived: PerceivedFacts,
  memory: OperationalMemory
): MergedInput {
  return {
    perceived,
    memory: {
      ...memory,
      stateEntities: { ...memory.stateEntities },
      selections: { ...memory.selections },
    },
  };
}
