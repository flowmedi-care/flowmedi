// FINANCEIRO FASE 1 — regras de competência de comandas (decisão 13.4)

type ComandaCompetenceInput = {
  status: string;
  closed_at: string | null;
  created_at: string;
};

/** Comanda entra na receita de competência se fechada ou paga; aberta/parcial sem closed_at não entra. */
export function isComandaCompetenceEligible(c: ComandaCompetenceInput): boolean {
  if (c.status === "cancelada" || c.status === "aberta") return false;
  if (c.status === "paga") return true;
  if (c.closed_at) return true;
  return false;
}

export function comandaCompetenceDate(c: ComandaCompetenceInput): string {
  return c.closed_at ?? c.created_at;
}

export function isComandaInPeriod(
  c: ComandaCompetenceInput,
  startIso: string,
  endIso: string
): boolean {
  if (!isComandaCompetenceEligible(c)) return false;
  const ref = comandaCompetenceDate(c);
  return ref >= startIso && ref <= endIso;
}
