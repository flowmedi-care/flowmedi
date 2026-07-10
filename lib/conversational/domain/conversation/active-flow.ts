import type { BookingDraft } from "../booking/booking-draft";
import type { CrmDraft } from "../crm/crm-draft";
import type { FaqDraft } from "../faq/faq-draft";
import type { PricingDraft } from "../pricing/pricing-draft";

export type ActiveFlow =
  | { kind: "booking"; draft: BookingDraft }
  | { kind: "pricing"; draft: PricingDraft }
  | { kind: "faq"; draft: FaqDraft }
  | { kind: "crm"; draft: CrmDraft };

export type FlowKind = ActiveFlow["kind"];

export function activeFlowKind(flow: ActiveFlow | null): FlowKind | null {
  return flow?.kind ?? null;
}
