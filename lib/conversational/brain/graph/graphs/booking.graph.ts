import type { ClinicConfig } from "../../../clinic/clinic-config";
import type { DomainGraph } from "../domain-graph";
import { buildDomainGraphFromPolicies } from "../../policies";

export function buildDomainGraph(config?: ClinicConfig): DomainGraph {
  return buildDomainGraphFromPolicies(config ?? ({} as ClinicConfig));
}
