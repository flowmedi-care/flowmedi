import type { InboundIntent } from "../detect-inbound-intent";

/** Rotas do assistente simplificado (MVP). */
export type AssistantRoute =
  | "greeting"
  | "discovery"
  | "pricing"
  | "booking"
  | "handoff"
  | "agent";

export type RouteSource = "regex" | "continuity" | "menu" | "fsm";

export type ResolvedRoute = {
  route: AssistantRoute;
  intent: InboundIntent;
  confidence: number;
  source: RouteSource;
};
