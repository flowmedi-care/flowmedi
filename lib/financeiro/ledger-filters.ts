import type { ExpenseCategory, UnifiedLedgerRow } from "./types";

export function filterLedgerRows(
  rows: UnifiedLedgerRow[],
  filters: {
    type?: "all" | "inflow" | "outflow";
    search?: string;
    category?: ExpenseCategory | "all";
  }
): UnifiedLedgerRow[] {
  return rows.filter((r) => {
    if (filters.type && filters.type !== "all" && r.type !== filters.type) return false;
    if (filters.category && filters.category !== "all" && r.category !== filters.category) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${r.counterparty} ${r.description} ${r.source_label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
