import type { DomainGraph } from "../../graph/domain-graph";
import type { StateGraph } from "../../graph/state-graph";
import { buildStateGraph } from "../../policies/domain-policy";
import type { MergedInput } from "./merge-memory";

export function inferBeliefs(
  merged: MergedInput,
  domain: DomainGraph
): StateGraph {
  return buildStateGraph(merged.perceived, merged.memory, domain);
}
