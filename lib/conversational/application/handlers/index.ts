import type { HandlerDomain } from "../../fsm/states";
import type { DomainHandler } from "./handler-types";
import {
  bookingHandler,
  crmHandler,
  faqHandler,
  handoffHandler,
  pricingHandler,
} from "./domain-handlers";
import { idleHandler } from "./idle-handler";

const HANDLERS: Record<HandlerDomain, DomainHandler> = {
  idle: idleHandler,
  booking: bookingHandler,
  pricing: pricingHandler,
  faq: faqHandler,
  crm: crmHandler,
  handoff: handoffHandler,
};

export function getHandlerForDomain(domain: HandlerDomain | null): DomainHandler | null {
  if (!domain) return null;
  return HANDLERS[domain] ?? null;
}
