import type { ClinicConfig } from "../../clinic/clinic-config";
import { emptyDomainGraph } from "../graph/domain-graph";
import { BookingPolicy } from "./booking-policy";
import { CommonPolicy } from "./common-policy";
import { PricingPolicy } from "./pricing-policy";
import type { DomainPolicy } from "./domain-policy";

export { BookingPolicy } from "./booking-policy";
export { PricingPolicy } from "./pricing-policy";
export { CommonPolicy } from "./common-policy";

export function allPolicies(): DomainPolicy[] {
  return [new BookingPolicy(), new PricingPolicy(), new CommonPolicy()];
}

export function allActions() {
  return allPolicies().flatMap((p) => p.registerActions());
}

export function buildDomainGraphFromPolicies(config: ClinicConfig = {} as ClinicConfig) {
  return allPolicies().reduce(
    (graph, policy) => policy.contributeToGraph(graph, config),
    emptyDomainGraph()
  );
}
