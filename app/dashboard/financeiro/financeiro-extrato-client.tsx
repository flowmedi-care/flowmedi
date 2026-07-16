"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PeriodFilter,
  useMonthPeriodUrl,
} from "@/components/dashboard-ui/filters/period-filter";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { fmtCurrency, downloadCsv } from "@/lib/financeiro/format";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/financeiro/constants";
import { filterLedgerRows } from "@/lib/financeiro/ledger-filters";
import { generateExpenseReceipt } from "./expense-receipt-actions";
import type { ExpenseCategory, UnifiedLedgerRow } from "@/lib/financeiro/types";
import { toast } from "@/components/ui/toast";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

type SupplierOption = { id: string; name: string };

export function FinanceiroExtratoClient({
  year,
  month,
  ledger,
  suppliers,
}: {
  year: number;
  month: number;
  ledger: UnifiedLedgerRow[];
  suppliers: SupplierOption[];
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "inflow" | "outflow">("all");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filterLedgerRows(ledger, {
        type: typeFilter,
        category: categoryFilter,
        search,
      }),
    [ledger, typeFilter, categoryFilter, search]
  );

  const inflow = filtered.filter((e) => e.type === "inflow").reduce((s, e) => s + e.amount, 0);
  const outflow = filtered.filter((e) => e.type === "outflow").reduce((s, e) => s + e.amount, 0);

  function exportCsv() {
    downloadCsv(`extrato-${year}-${month}.csv`, [
      ["Data/Hora", "Tipo", "Contraparte", "Origem", "Descrição", "Valor", "Saldo", "Método"],
      ...filtered.map((e) => [
        new Date(e.occurred_at).toLocaleString("pt-BR"),
        e.type === "inflow" ? "Entrada" : "Saída",
        e.counterparty,
        e.source_label,
        e.description,
        String(e.type === "inflow" ? e.amount : -e.amount),
        String(e.running_balance),
        e.payment_method ?? "",
      ]),
    ]);
  }

  async function openReceipt(row: UnifiedLedgerRow) {
    if (row.receipt_id) {
      window.open(`/dashboard/financeiro/recibo/${row.receipt_id}`, "_blank");
      return;
    }
    if (row.financial_entry_id && row.type === "outflow") {
      const res = await generateExpenseReceipt(row.financial_entry_id);
      if (res.error) toast(res.error, "error");
      else if (res.receiptId) window.open(`/dashboard/financeiro/comprovante-despesa/${res.receiptId}`, "_blank");
      return;
    }
    toast("Comprovante não disponível.", "error");
  }

  const monthPeriod = useMonthPeriodUrl(year, month);

  return (
    <div className="space-y-6">
      <PageToolbar>
        <PageToolbar.Filters>
          <PeriodFilter
            mode="month"
            value={monthPeriod.value}
            onChange={monthPeriod.onChange}
            actions={
              <Button variant="outline" size="sm" className="h-10 shadow-none" onClick={exportCsv}>
                Exportar CSV
              </Button>
            }
          />
        </PageToolbar.Filters>
      </PageToolbar>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><p className="text-sm text-muted-foreground">Entradas</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-emerald-600">{fmtCurrency(inflow)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><p className="text-sm text-muted-foreground">Saídas</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-red-600">{fmtCurrency(outflow)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><p className="text-sm text-muted-foreground">Saldo do período</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{fmtCurrency(inflow - outflow)}</p></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
            <option value="all">Todos</option>
            <option value="inflow">Entradas</option>
            <option value="outflow">Saídas</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | "all")}>
            <option value="all">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Paciente, fornecedor, descrição…" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum lançamento" description="Não há movimentações no período selecionado." />
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const isExpanded = expanded === row.id;
            const initial = row.counterparty.charAt(0).toUpperCase();
            return (
              <div key={row.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${row.type === "inflow" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"}`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.counterparty}</p>
                        <p className="text-sm text-muted-foreground">{row.source_label} · {row.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(row.occurred_at).toLocaleString("pt-BR")}
                          {row.payment_method && ` · ${row.payment_method}`}
                          {row.bank_account_name && ` · ${row.bank_account_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${row.type === "inflow" ? "text-emerald-600" : "text-red-600"}`}>
                          {row.type === "inflow" ? "+" : "−"}{fmtCurrency(row.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">Saldo {fmtCurrency(row.running_balance)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {row.category && (
                        <Badge variant="secondary">{CATEGORY_LABELS[row.category]}</Badge>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(isExpanded ? null : row.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Detalhes
                      </Button>
                      {(row.receipt_id || row.financial_entry_id) && (
                        <Button size="sm" variant="outline" onClick={() => openReceipt(row)}>
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Comprovante
                        </Button>
                      )}
                      {(row.appointment_id || row.comanda_id) && (
                        <Link
                          href={
                            row.appointment_id
                              ? `/dashboard/agenda/consulta/${row.appointment_id}`
                              : "/dashboard/financeiro/receber"
                          }
                        >
                          <Button size="sm" variant="ghost">Ver comanda</Button>
                        </Link>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t text-sm space-y-1 text-muted-foreground">
                        <p>Origem: {row.source === "payment" ? "Pagamento de paciente" : "Lançamento financeiro"}</p>
                        {row.patient_id && <p>ID paciente: {row.patient_id}</p>}
                        {row.financial_entry_id && <p>ID lançamento: {row.financial_entry_id}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
