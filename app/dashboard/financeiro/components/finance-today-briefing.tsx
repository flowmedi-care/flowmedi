"use client";

import { Progress } from "@/components/ui/progress";
import { fmtCurrency } from "@/lib/financeiro/format";
import type { FinanceTodayBriefing } from "@/lib/financeiro/types";

export function FinanceTodayBriefingCard({ briefing }: { briefing: FinanceTodayBriefing }) {
  const {
    greeting,
    userFirstName,
    cobrarCount,
    receberCount,
    entrouHoje,
    cobrancasDoneToday,
    cobrancasRemaining,
    recebidosDoneToday,
    recebidosTotal,
  } = briefing;

  const cobrancasTotal = cobrancasDoneToday + cobrancasRemaining;
  const cobrancasPct =
    cobrancasTotal > 0 ? Math.round((cobrancasDoneToday / cobrancasTotal) * 100) : 100;
  const recebidosPct =
    recebidosTotal > 0 ? Math.round((recebidosDoneToday / recebidosTotal) * 100) : 100;

  const name = userFirstName ? `, ${userFirstName}` : "";

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hoje</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {greeting}
          {name}.
        </h2>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>
            {cobrarCount === 0
              ? "Nenhum paciente aguarda cobrança."
              : `${cobrarCount} paciente${cobrarCount === 1 ? "" : "s"} aguarda${cobrarCount === 1 ? "" : "m"} cobrança.`}
          </p>
          <p>
            {receberCount === 0
              ? "Nenhum pagamento pendente."
              : `${receberCount} pagamento${receberCount === 1 ? "" : "s"} ${receberCount === 1 ? "está" : "estão"} pendente${receberCount === 1 ? "" : "s"}.`}
          </p>
          <p>
            {entrouHoje > 0
              ? `${fmtCurrency(entrouHoje)} entraram hoje.`
              : "Ainda não houve entradas no caixa hoje."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">Cobranças</span>
            <span className="tabular-nums text-muted-foreground">
              {cobrancasDoneToday} concluídas · {cobrancasRemaining} restantes
            </span>
          </div>
          <Progress value={cobrancasPct} className="h-2" />
          <p className="text-xs text-muted-foreground tabular-nums">{cobrancasPct}%</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">Recebidos</span>
            <span className="tabular-nums text-muted-foreground">
              {recebidosDoneToday} / {Math.max(recebidosTotal, recebidosDoneToday)}
            </span>
          </div>
          <Progress value={recebidosPct} className="h-2" />
          <p className="text-xs text-muted-foreground tabular-nums">{recebidosPct}%</p>
        </div>
      </div>
    </section>
  );
}
