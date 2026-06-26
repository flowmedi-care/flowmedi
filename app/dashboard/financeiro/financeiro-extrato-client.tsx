// FINANCEIRO FASE 1 — ITEM 7: extrato reformulado

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PeriodSelector } from "./components/period-selector";
import { PageToolbar } from "@/components/dashboard-ui/page-toolbar";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { fmtCurrency, downloadCsv } from "@/lib/financeiro/format";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/financeiro/constants";
import type { ExpenseCategory, FinancialEntryRow, FinancialLens } from "@/lib/financeiro/types";

type SupplierOption = { id: string; name: string };

const LENS_BADGE: Record<FinancialLens, string> = {
  caixa: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  competencia: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  manual: "bg-muted text-muted-foreground",
  previsto: "bg-muted text-muted-foreground",
};

const LENS_LABEL: Record<FinancialLens, string> = {
  caixa: "Caixa",
  competencia: "Competência",
  manual: "Manual",
  previsto: "Previsto",
};

export function FinanceiroExtratoClient({
  year,
  month,
  entries,
  suppliers,
}: {
  year: number;
  month: number;
  entries: FinancialEntryRow[];
  suppliers: SupplierOption[];
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "receita" | "despesa">("all");
  const [lensFilter, setLensFilter] = useState<FinancialLens | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
      if (lensFilter !== "all" && e.lens !== lensFilter) return false;
      if (supplierFilter && e.supplier_id !== supplierFilter) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      return true;
    });
  }, [entries, typeFilter, lensFilter, supplierFilter, categoryFilter]);

  const inflow = filtered
    .filter((e) => e.entry_type === "receita" && e.status === "pago")
    .reduce((s, e) => s + e.amount, 0);
  const outflow = filtered
    .filter((e) => e.entry_type === "despesa" && e.status === "pago")
    .reduce((s, e) => s + e.amount, 0);

  function exportCsv() {
    downloadCsv(`extrato-${year}-${month}.csv`, [
      ["Data", "Tipo", "Lente", "Descrição", "Fornecedor", "Categoria", "Valor", "Status"],
      ...filtered.map((e) => [
        e.paid_at?.slice(0, 10) ?? e.due_date ?? e.created_at.slice(0, 10),
        e.entry_type,
        LENS_LABEL[e.lens],
        e.description,
        e.supplier_display_name ?? "",
        e.category ? CATEGORY_LABELS[e.category] : "",
        String(e.amount),
        e.status,
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <PageToolbar filters={<PeriodSelector year={year} month={month} />}>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          Exportar CSV
        </Button>
      </PageToolbar>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Extrato — Movimentos e lançamentos</h2>
          <p className="text-sm text-muted-foreground">
            Histórico unificado de receitas e despesas com identificação de lente contábil.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              >
                <option value="all">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lente</Label>
              <Select
                value={lensFilter}
                onChange={(e) => setLensFilter(e.target.value as FinancialLens | "all")}
              >
                <option value="all">Todas</option>
                <option value="caixa">Caixa</option>
                <option value="competencia">Competência</option>
                <option value="manual">Manual</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                <option value="">Todos</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | "all")}
              >
                <option value="all">Todas</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Nenhum lançamento no período" />
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable
                  columns={[
                    {
                      key: "date",
                      header: "Data",
                      cell: (e) => (
                        <span className="text-muted-foreground">
                          {(e.paid_at ?? e.due_date ?? e.created_at).slice(0, 10)}
                        </span>
                      ),
                    },
                    {
                      key: "lens",
                      header: "Lente",
                      cell: (e) => (
                        <Badge className={LENS_BADGE[e.lens]}>{LENS_LABEL[e.lens]}</Badge>
                      ),
                    },
                    { key: "desc", header: "Descrição", cell: (e) => e.description },
                    {
                      key: "supplier",
                      header: "Fornecedor",
                      cell: (e) => e.supplier_display_name ?? "—",
                    },
                    {
                      key: "amount",
                      header: "Valor",
                      className: "text-right font-medium",
                      cell: (e) => (
                        <span
                          className={
                            e.entry_type === "receita" ? "text-green-700 dark:text-green-400" : ""
                          }
                        >
                          {e.entry_type === "despesa" ? "−" : "+"}
                          {fmtCurrency(e.amount)}
                        </span>
                      ),
                    },
                    { key: "status", header: "Status", cell: (e) => e.status },
                  ]}
                  data={filtered}
                  getRowKey={(e) => e.id}
                />
              </div>

              <div className="md:hidden space-y-3">
                {filtered.map((e) => (
                  <div key={e.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex justify-between">
                      <Badge className={LENS_BADGE[e.lens]}>{LENS_LABEL[e.lens]}</Badge>
                      <span className="font-medium">{fmtCurrency(e.amount)}</span>
                    </div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{e.status}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 pt-4 border-t text-sm">
                <span>
                  Entradas:{" "}
                  <strong className="text-green-700 dark:text-green-400">{fmtCurrency(inflow)}</strong>
                </span>
                <span>
                  Saídas: <strong>{fmtCurrency(outflow)}</strong>
                </span>
                <span>
                  Saldo:{" "}
                  <strong className={inflow - outflow >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}>
                    {fmtCurrency(inflow - outflow)}
                  </strong>
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
