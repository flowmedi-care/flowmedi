// FINANCEIRO FASE 1 — ITEM 1: visão geral reformulada

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { PageToolbar } from "@/components/dashboard-ui/page-toolbar";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
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
  userRole,
}: {
  year: number;
  month: number;
  metrics: DashboardMetrics;
  openComandas: OpenComandaRow[];
  suppliers: SupplierOption[];
  canManage: boolean;
  userRole?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [payComanda, setPayComanda] = useState<{ id: string; remainder: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OpenComandaRow | null>(null);

  return (
    <div className="space-y-6">
      <PageToolbar
        filters={<PeriodSelector year={year} month={month} />}
      >
        {canManage && (
          <Button onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Lançamento
          </Button>
        )}
      </PageToolbar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Receita Faturada (Competência)"
          value={fmtCurrency(metrics.receitaFaturada)}
          subtitle="Valor cobrado aos pacientes, por emissão da comanda."
          iconColor="primary"
        />
        <StatCard
          title="Entradas no Caixa"
          value={fmtCurrency(metrics.entradasCaixa)}
          subtitle="Dinheiro que efetivamente entrou, por data de pagamento."
          iconColor="success"
        />
        <StatCard
          title="A Receber"
          value={fmtCurrency(metrics.aReceber)}
          subtitle="Comandas abertas aguardando pagamento."
          iconColor="info"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Saídas no Caixa"
          value={fmtCurrency(metrics.saidasCaixa)}
          subtitle="Despesas pagas no período selecionado."
        />
        <StatCard
          title="A Pagar"
          value={fmtCurrency(metrics.aPagar)}
          subtitle={
            metrics.aPagarVencidas > 0
              ? `${fmtCurrency(metrics.aPagarVencidas)} vencidas · ${fmtCurrency(metrics.aPagarVencendo7d)} nos próximos 7 dias`
              : "Despesas pendentes de pagamento."
          }
          iconColor={metrics.aPagarVencidas > 0 ? "warning" : "primary"}
        />
        <StatCard
          title="Resultado do Período"
          value={fmtCurrency(metrics.resultadoPeriodo)}
          subtitle="Entradas no caixa − saídas no caixa."
          iconColor={metrics.resultadoPeriodo >= 0 ? "success" : "destructive"}
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
            <EmptyState
              title="Nenhuma comanda em aberto"
              description="Todas as comandas estão quitadas no momento."
            />
          ) : (
            <>
              <div className="hidden md:block">
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
                    {
                      key: "discount",
                      header: "Desconto",
                      className: "text-right",
                      cell: (c) => (c.discount_amount > 0 ? `-${fmtCurrency(c.discount_amount)}` : "—"),
                    },
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
                          </div>
                        ) : null,
                    },
                  ]}
                  data={openComandas}
                  getRowKey={(c) => c.id}
                />
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
