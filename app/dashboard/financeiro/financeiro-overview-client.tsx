"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatCard } from "@/components/dashboard-ui/stat-card";
import { FinancialEntryFormDialog } from "./components/financial-entry-form-dialog";
import { ComandaPaymentDialog } from "./components/comanda-payment-dialog";
import { FinanceOverviewCharts } from "./components/finance-overview-charts";
import { FinanceTodayBriefingCard } from "./components/finance-today-briefing";
import { FinanceMyQueue } from "./components/finance-my-queue";
import { fmtCurrency } from "@/lib/financeiro/format";
import type {
  FinanceChartData,
  FinanceHomeIndicators,
  FinanceQueueItem,
  FinanceTodayBriefing,
} from "@/lib/financeiro/types";

type SupplierOption = { id: string; name: string };

export function FinanceiroOverviewClient({
  briefing,
  indicators,
  chartData,
  cobrar,
  receber,
  recebido,
  suppliers,
  canManage,
}: {
  briefing: FinanceTodayBriefing;
  indicators: FinanceHomeIndicators;
  chartData: FinanceChartData;
  cobrar: FinanceQueueItem[];
  receber: FinanceQueueItem[];
  recebido: FinanceQueueItem[];
  suppliers: SupplierOption[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [payComanda, setPayComanda] = useState<{ id: string; remainder: number } | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={() => setShowForm(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Lançamento
          </Button>
        )}
      </div>

      <FinanceTodayBriefingCard briefing={briefing} />

      <FinanceMyQueue
        cobrar={cobrar}
        receber={receber}
        recebido={recebido}
        canManage={canManage}
        onReceber={(id, remainder) => setPayComanda({ id, remainder })}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Indicadores</h2>
          <p className="text-sm text-muted-foreground">Onde merece atenção agora.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/financeiro/fluxo-caixa" className="block transition-opacity hover:opacity-90">
            <StatCard
              title="Entrou hoje"
              value={fmtCurrency(indicators.entrouHoje)}
              subtitle="Caixa de hoje"
              iconColor="success"
            />
          </Link>
          <Link href="/dashboard/financeiro/receber" className="block transition-opacity hover:opacity-90">
            <StatCard
              title="Ainda falta receber"
              value={fmtCurrency(indicators.aindaFaltaReceber)}
              subtitle="Saldo em aberto"
              iconColor="info"
            />
          </Link>
          <Link href="/dashboard/financeiro/pagar" className="block transition-opacity hover:opacity-90">
            <StatCard
              title="Contas vencidas"
              value={fmtCurrency(indicators.contasVencidas)}
              subtitle="Despesas em atraso"
              iconColor={indicators.contasVencidas > 0 ? "warning" : "primary"}
            />
          </Link>
          <Link href="/dashboard/financeiro/pagar" className="block transition-opacity hover:opacity-90">
            <StatCard
              title="Contas a pagar"
              value={fmtCurrency(indicators.contasAPagar)}
              subtitle="Pendentes"
              iconColor="primary"
            />
          </Link>
        </div>
      </section>

      <FinanceOverviewCharts
        data={chartData}
        showAging={indicators.aindaFaltaReceber > 0}
      />

      {canManage && (
        <>
          <FinancialEntryFormDialog open={showForm} onOpenChange={setShowForm} suppliers={suppliers} />
          <ComandaPaymentDialog
            comandaId={payComanda?.id ?? null}
            defaultAmount={payComanda?.remainder ?? 0}
            onClose={() => setPayComanda(null)}
          />
        </>
      )}
    </div>
  );
}
