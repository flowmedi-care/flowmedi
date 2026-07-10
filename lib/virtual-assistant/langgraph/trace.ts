export const CAPTACAO_GREETING_MENU =
  "Olá! Como posso ajudar?\n1. Agendar consulta\n2. Conhecer a clínica\n3. Falar com atendente";

export function logLangGraphTrace(
  _supabase: unknown,
  _clinicId: string,
  _conversationId: string,
  _detail: Record<string, unknown>
): void {
  // no-op: LangGraph removido; mantido para compat com action-table
}
