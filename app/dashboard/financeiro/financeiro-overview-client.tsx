"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { PageToolbar } from "@/components/dashboard-ui/toolbar/page-toolbar";
import {
  PeriodFilter,
  useMonthPeriodUrl,
} from "@/components/dashboard-ui/filters/period-filter";
import { FinancialEntryFormDialog } from "./components/financial-entry-form-dialog";
import { ComandaPaymentDialog } from "./components/comanda-payment-dialog";
import { CancelComandaDialog } from "./components/cancel-comanda-dialog";
import { FinanceOverviewCharts } from "./components/finance-overview-charts";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { fmtCurrency } from "@/lib/financeiro/format";
import type {
  DashboardMetricsExtended,
  FinanceChartData,
  OpenComandaRow,
} from "@/lib/financeiro/types";

type SupplierOption = { id: string; name: string };

export function FinanceiroOverviewClient({
  year,
  month,
  metrics,
  chartData,
  openComandas,
  suppliers,
  canManage,
  userRole,
}: {
  year: number;
  month: number;
  metrics: DashboardMetricsExtended;
  chartData: FinanceChartData;
  openComandas: OpenComandaRow[];
  suppliers: SupplierOption[];
  canManage: boolean;
  userRole?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [payComanda, setPayComanda] = useState<{ id: string; remainder: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OpenComandaRow | null>(null);

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
              canManage ? (
                <Button onClick={() => setShowForm(true)} className="h-10 shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Lançamento
                </Button>
              ) : undefined
            }
          />
        </PageToolbar.Filters>
      </PageToolbar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita Faturada"
          value={fmtCurrency(metrics.receitaFaturada)}
          subtitle={`Competência · ${metrics.comandasNoPeriodo} comandas · MoM ${metrics.momReceitaPct.toFixed(1)}%`}
          iconColor="primary"
        />
        <StatCard
          title="Margem Bruta"
          value={fmtCurrency(metrics.margemBruta)}
          subtitle="Receita − CMV (custo real dos materiais)."
          iconColor="success"
        />
        <StatCard
          title="Entradas no Caixa"
          value={fmtCurrency(metrics.entradasCaixa)}
          subtitle="Dinheiro recebido no período."
          iconColor="success"
        />
        <StatCard
          title="Resultado do Período"
          value={fmtCurrency(metrics.resultadoPeriodo)}
          subtitle="Entradas − saídas (caixa)."
          iconColor={metrics.resultadoPeriodo >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="A Receber"
          value={fmtCurrency(metrics.aReceber)}
          subtitle={`Inadimplência ${metrics.taxaInadimplencia.toFixed(1)}%`}
          iconColor="info"
        />
        <StatCard
          title="A Pagar"
          value={fmtCurrency(metrics.aPagar)}
          subtitle={
            metrics.aPagarVencidas > 0
              ? `${fmtCurrency(metrics.aPagarVencidas)} vencidas`
              : "Despesas pendentes."
          }
          iconColor={metrics.aPagarVencidas > 0 ? "warning" : "primary"}
        />
        <StatCard
          title="Ticket Médio"
          value={fmtCurrency(metrics.ticketMedio)}
          subtitle="Receita faturada ÷ comandas."
        />
        <StatCard
          title="Projeção 30 dias"
          value={fmtCurrency(metrics.projecao30d)}
          subtitle={`No-show ${metrics.taxaNoShow.toFixed(1)}% · recorrências + AR`}
          iconColor="info"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Saídas no Caixa"
          value={fmtCurrency(metrics.saidasCaixa)}
          subtitle={`Burn rate ${fmtCurrency(metrics.burnRate)}/mês`}
        />
        <StatCard
          title="Runway estimado"
          value={metrics.runway > 0 ? `${metrics.runway.toFixed(1)} meses` : "—"}
          subtitle="Com base na média de saídas dos últimos 3 meses."
        />
        <StatCard
          title="Variação receita (MoM)"
          value={`${metrics.momReceitaPct >= 0 ? "+" : ""}${metrics.momReceitaPct.toFixed(1)}%`}
          subtitle="Comparado ao mês anterior."
        />
      </div>

      <FinanceOverviewCharts data={chartData} />

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Comandas em aberto</h2>
          <p className="text-sm text-muted-foreground">Contas a receber — saldo pendente de pacientes.</p>
        </CardHeader>
        <CardContent>
          {openComandas.length === 0 ? (
            <EmptyState title="Nenhuma comanda em aberto" description="Todas as comandas estão quitadas." />
          ) : (
            <DataTable
              columns={[
                { key: "patient", header: "Paciente", cell: (c) => <span className="font-medium">{c.patient_name}</span> },
                {
                  key: "date",
                  header: "Data",
                  cell: (c) =>
                    c.scheduled_at
                      ? new Date(c.scheduled_at).toLocaleDateString("pt-BR")
                      : new Date(c.created_at).toLocaleDateString("pt-BR"),
                },
                { key: "total", header: "Total", className: "text-right", cell: (c) => fmtCurrency(c.total_amount) },
                { key: "paid", header: "Pago", className: "text-right", cell: (c) => fmtCurrency(c.paid_amount) },
                {
                  key: "remainder",
                  header: "Saldo",
                  className: "text-right font-medium text-amber-700 dark:text-amber-400",
                  cell: (c) => fmtCurrency(c.remainder),
                },
                { key: "days", header: "Dias", className: "text-right", cell: (c) => c.days_open },
                {
                  key: "actions",
                  header: "",
                  className: "text-right",
                  cell: (c) =>
                    canManage ? (
                      <div className="space-x-1">
                        <Button size="sm" variant="outline" onClick={() => setPayComanda({ id: c.id, remainder: c.remainder })}>
                          Pagar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelTarget(c)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : null,
                },
              ]}
              data={openComandas}
              getRowKey={(c) => c.id}
            />
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <FinancialEntryFormDialog open={showForm} onOpenChange={setShowForm} suppliers={suppliers} />
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
                    status: cancelTarget.status,
                  }
                : null
            }
            userRole={userRole}
            onClose={() => setCancelTarget(null)}
          />
        </>
      )}
    </div>
  );
}
