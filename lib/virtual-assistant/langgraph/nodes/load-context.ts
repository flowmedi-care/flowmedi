import { buildClinicContext } from "../../clinic-context";
import type { GraphState } from "../state";

export async function loadContextNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const clinicCtx = await buildClinicContext(ctx.supabase, ctx.clinicId);

  return {
    clinicDataText: clinicCtx.text,
    runtimeContext: {
      ...ctx,
      settings: { ...ctx.settings, ...clinicCtx.settings },
    },
  };
}
