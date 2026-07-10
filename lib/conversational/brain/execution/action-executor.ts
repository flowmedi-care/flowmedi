import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import type { ClinicConfig } from "../../clinic/clinic-config";
import type { ToolGateway } from "../../tools/gateway";
import type { ToolName } from "../../tools/registry";
import type { TurnContext } from "../types/turn-context";
import type { Action } from "../reasoning/actions/action";
import { searchFaqWithFallback } from "../knowledge/faq-retrieval";

export type ToolObservation = {
  ok: boolean;
  entity?: string;
  value?: unknown;
  facts: Record<string, unknown>;
  error?: string;
};

export async function executeAction(
  action: Action,
  ctx: TurnContext,
  deps: {
    supabase: SupabaseClient;
    config: ClinicConfig;
    gateway: ToolGateway;
    aiState: AiConversationState;
  }
): Promise<ToolObservation> {
  if (action.kind !== "tool" || !("tool" in action.payload)) {
    return { ok: false, facts: {} };
  }

  const tool = action.payload.tool;
  const args = { ...action.payload.args };

  if (tool === "listSlots" && !args.serviceId) {
    const proc = ctx.operationalMemory.selections.serviceId;
    if (proc) args.serviceId = proc;
    const dateEntity = ctx.operationalMemory.stateEntities.date?.value;
    if (dateEntity) args.date = String(dateEntity);
  }

  if (tool === "getPriceQuote" && !args.serviceId) {
    const proc = ctx.operationalMemory.selections.serviceId;
    if (proc) args.serviceId = proc;
  }

  if (tool === "searchFaq") {
    const query = String(args.query ?? ctx.message);
    const faqHit = await searchFaqWithFallback(
      query,
      deps.config.faqs,
      deps.supabase,
      ctx.conversation.clinicId
    );
    return {
      ok: Boolean(faqHit),
      entity: "faq",
      value: faqHit,
      facts: { faq: faqHit },
    };
  }

  const result = await deps.gateway.execute(
    { name: tool as ToolName, args },
    {
      clinicId: ctx.conversation.clinicId,
      conversationId: ctx.conversation.id,
      phoneNumber: ctx.phoneNumber,
      domain: "brain",
      fsmState: "brain.active",
      turnId: ctx.turnId,
    }
  );

  if (!result.ok) {
    return { ok: false, facts: {}, error: result.error };
  }

  const facts: Record<string, unknown> = { [tool]: result.data };
  let entity: string | undefined;
  let value: unknown = result.data;

  if (tool === "listServices" && Array.isArray(result.data)) {
    const list = result.data as Array<{ id: string; name: string }>;
    facts.services = list;
    const match = pickServiceMatch(list, ctx.message);
    if (match) {
      entity = "procedure";
      value = match.name;
      facts.matchId = match.id;
      facts.matchName = match.name;
    }
  }

  if (tool === "findPatient" && result.data) {
    entity = "patient";
    value = (result.data as { id: string }).id;
  }

  if (tool === "listSlots" && result.data) {
    entity = "slot";
    const slots = normalizeSlots(result.data);
    facts.slots = slots;
    value = slots;
  }

  if (tool === "getPriceQuote" && result.data) {
    entity = "price";
    facts.price = result.data;
  }

  if (tool === "createAppointment") {
    entity = "appointment";
    facts.appointment = result.data;
  }

  if (tool === "openHandoffTicket") {
    entity = "handoff";
    facts.handoff = result.data;
  }

  return { ok: true, entity, value, facts };
}

function pickServiceMatch(
  list: Array<{ id: string; name: string }>,
  query: string
): { id: string; name: string } | null {
  if (!list.length) return null;
  const lower = query.toLowerCase();
  return (
    list.find((s) => lower.includes(s.name.toLowerCase())) ??
    list.find((s) => s.name.toLowerCase().includes(lower.slice(0, 4))) ??
    null
  );
}

function normalizeSlots(data: unknown): unknown {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "slots" in data) {
    return (data as { slots: unknown }).slots;
  }
  return data;
}
