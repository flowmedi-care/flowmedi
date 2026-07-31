"use server";

import { ensureActivationSeedAction } from "@/lib/onboarding/actions";

/**
 * Compat: botão antigo "Criar atendimento demo" agora usa o seed completo da ativação.
 */
export async function createDemoAtendimentoAction(): Promise<{
  caseId: string | null;
  error: string | null;
}> {
  const res = await ensureActivationSeedAction();
  return { caseId: res.caseId, error: res.error };
}
