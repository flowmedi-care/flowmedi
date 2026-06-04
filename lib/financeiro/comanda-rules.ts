// Regras de competência de comandas

type ComandaCompetenceInput = {
  status: string;
  closed_at: string | null;
  created_at: string;
  issued_at?: string | null;
};

/** Comanda emitida entra na competência; cancelada e sem emissão não entram. */
export function isComandaCompetenceEligible(c: ComandaCompetenceInput): boolean {
  if (c.status === "cancelada") return false;
  if (c.issued_at) return true;
  if (c.status === "aberta") return false;
  if (c.status === "paga") return true;
  if (c.closed_at) return true;
  return false;
}

export function comandaCompetenceDate(c: ComandaCompetenceInput): string {
  return c.issued_at ?? c.closed_at ?? c.created_at;
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
