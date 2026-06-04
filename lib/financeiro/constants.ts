// FINANCEIRO FASE 1 — constantes

import type { ExpenseCategory } from "./types";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "aluguel", label: "Aluguel" },
  { value: "salarios", label: "Salários" },
  { value: "materiais", label: "Materiais" },
  { value: "laboratorio", label: "Laboratório" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "marketing", label: "Marketing" },
  { value: "outros", label: "Outros" },
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
