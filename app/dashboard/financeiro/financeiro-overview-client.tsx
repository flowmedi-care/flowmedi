// FINANCEIRO FASE 1 — ITEM 1: visão geral reformulada

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { MetricCard } from "./components/metric-card";
import { PeriodSelector } from "./components/period-selector";
import { FinancialEntryFormDialog } from "./components/financial-entry-form-dialog";
import { ComandaPaymentDialog } from "./components/comanda-payment-dialog";
import { CancelComandaDialog } from "./components/cancel-comanda-dialog";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { DashboardMetrics, OpenComandaRow } from "@/lib/financeiro/types";

type SupplierOption = { id: string; name: string };

export function FinanceiroOverviewClient({
  year,
  month,
  metrics,
  openComandas,
  suppliers,
  canManage,
}: {
  year: number;
  month: number;
  metrics: DashboardMetrics;
  openComandas: OpenComandaRow[];
  suppliers: SupplierOption[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [payComanda, setPayComanda] = useState<{ id: string; remainder: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OpenComandaRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PeriodSelector year={year} month={month} />
        {canManage && (
          <Button onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Lançamento
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Receita Faturada (Competência)"
          lens="Competência"
          value={fmtCurrency(metrics.receitaFaturada)}
          subtitle="Valor cobrado aos pacientes, por data de fechamento da comanda."
        />
        <MetricCard
          title="Entradas no Caixa"
          lens="Caixa"
          value={fmtCurrency(metrics.entradasCaixa)}
          subtitle="Dinheiro que efetivamente entrou, por data de pagamento."
        />
        <MetricCard
          title="A Receber"
          lens="AR"
          value={fmtCurrency(metrics.aReceber)}
          subtitle="Comandas abertas aguardando pagamento."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Saídas no Caixa"
          lens="Caixa"
          value={fmtCurrency(metrics.saidasCaixa)}
          subtitle="Despesas pagas no período selecionado."
        />
        <MetricCard
          title="A Pagar"
          lens="AP"
          value={fmtCurrency(metrics.aPagar)}
          subtitle={
            metrics.aPagarVencidas > 0
              ? `${fmtCurrency(metrics.aPagarVencidas)} vencidas · ${fmtCurrency(metrics.aPagarVencendo7d)} nos próximos 7 dias`
              : "Despesas pendentes de pagamento."
          }
          variant={metrics.aPagarVencidas > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="Resultado do Período"
          lens="Caixa"
          value={fmtCurrency(metrics.resultadoPeriodo)}
          subtitle="Entradas no caixa − saídas no caixa."
          variant={metrics.resultadoPeriodo >= 0 ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Comandas em aberto</h2>
          <p className="text-sm text-muted-foreground">
            Contas a receber — saldo pendente de pacientes.
          </p>
        </CardHeader>
        <CardContent>
          {openComandas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma comanda em aberto.
            </p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2">Paciente</th>
                      <th className="pb-2 pr-2">Data</th>
                      <th className="pb-2 pr-2 text-right">Total</th>
                      <th className="pb-2 pr-2 text-right">Pago</th>
                      <th className="pb-2 pr-2 text-right">Saldo</th>
                      <th className="pb-2 pr-2 text-right">Dias</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {openComandas.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-3 pr-2 font-medium">{c.patient_name}</td>
                        <td className="py-3 pr-2 text-muted-foreground">
                          {c.scheduled_at
                            ? new Date(c.scheduled_at).toLocaleDateString("pt-BR")
                            : new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 pr-2 text-right">{fmtCurrency(c.total_amount)}</td>
                        <td className="py-3 pr-2 text-right">{fmtCurrency(c.paid_amount)}</td>
                        <td className="py-3 pr-2 text-right font-medium text-amber-700 dark:text-amber-400">
                          {fmtCurrency(c.remainder)}
                        </td>
                        <td className="py-3 pr-2 text-right">{c.days_open}</td>
                        <td className="py-3 text-right space-x-1">
                          {canManage && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPayComanda({ id: c.id, remainder: c.remainder })}
                              >
                                Registrar pagamento
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setCancelTarget(c)}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {openComandas.map((c) => (
                  <div key={c.id} className="border rounded-lg p-3 space-y-2">
                    <p className="font-medium">{c.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Saldo {fmtCurrency(c.remainder)} · {c.days_open} dias em aberto
                    </p>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => setPayComanda({ id: c.id, remainder: c.remainder })}
                        >
                          Registrar pagamento
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCancelTarget(c)}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <FinancialEntryFormDialog
            open={showForm}
            onOpenChange={setShowForm}
            suppliers={suppliers}
          />
          <ComandaPaymentDialog
            comandaId={payComanda?.id ?? null}
            defaultAmount={payComanda?.remainder ?? 0}
            onClose={() => setPayComanda(null)}
          />
          <CancelComandaDialog
            comanda={
              cancelTarget
                ? {
                    id: cancelTarget.id,
                    patient_name: cancelTarget.patient_name,
                    total_amount: cancelTarget.total_amount,
                    paid_amount: cancelTarget.paid_amount,
                  }
                : null
            }
            onClose={() => setCancelTarget(null)}
          />
        </>
      )}
    </div>
  );
}
