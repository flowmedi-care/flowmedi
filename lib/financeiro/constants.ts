// FINANCEIRO — constantes

import type { DreSection, ExpenseCategory } from "./types";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; dreSection?: DreSection }[] = [
  { value: "aluguel", label: "Aluguel", dreSection: "operacional" },
  { value: "salarios", label: "Salários", dreSection: "operacional" },
  { value: "materiais", label: "Materiais", dreSection: "operacional" },
  { value: "laboratorio", label: "Laboratório", dreSection: "operacional" },
  { value: "equipamentos", label: "Equipamentos", dreSection: "operacional" },
  { value: "marketing", label: "Marketing", dreSection: "operacional" },
  { value: "taxas_bancarias", label: "Taxas bancárias", dreSection: "operacional" },
  { value: "financeiras", label: "Despesas financeiras", dreSection: "operacional" },
  { value: "depreciacao", label: "Depreciação e amortização", dreSection: "depreciacao" },
  { value: "pecld", label: "PECLD (provisão inadimplência)", dreSection: "pecld" },
  { value: "impostos", label: "IR e CSLL", dreSection: "impostos" },
  { value: "outros", label: "Outros", dreSection: "operacional" },
];

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "outro", label: "Outro" },
] as const;

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
) as Record<ExpenseCategory, string>;

export const DRE_CATEGORY_ORDER: ExpenseCategory[] = [
  "aluguel",
  "salarios",
  "materiais",
  "laboratorio",
  "equipamentos",
  "marketing",
  "taxas_bancarias",
  "financeiras",
  "outros",
];

export const RECURRENCE_FREQUENCIES = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
] as const;

export function categoryToDreSection(category: ExpenseCategory | null): DreSection {
  const found = EXPENSE_CATEGORIES.find((c) => c.value === category);
  return found?.dreSection ?? "operacional";
}
