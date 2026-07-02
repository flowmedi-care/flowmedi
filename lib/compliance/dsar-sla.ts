/** Prazos DSAR — art. 18 §1 LGPD (5 dias confirmação / 15 dias resposta). */

export type DsarSlaTier = "simple" | "standard";

const SIMPLE_TYPES = new Set(["access", "correction", "portability"]);

export function getDsarSlaTier(requestType: string): DsarSlaTier {
  return SIMPLE_TYPES.has(requestType) ? "simple" : "standard";
}

/** Adiciona dias úteis (seg–sex) a uma data. */
export function addBusinessDays(start: Date, businessDays: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

export function computeDsarDueAt(requestType: string, createdAt: Date = new Date()): Date {
  const tier = getDsarSlaTier(requestType);
  const days = tier === "simple" ? 5 : 15;
  return addBusinessDays(createdAt, days);
}

export function formatDsarDueAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function isDsarOverdue(dueAt: string | null | undefined, status: string): boolean {
  if (!dueAt || status === "completed" || status === "rejected") return false;
  return new Date(dueAt) < new Date();
}
