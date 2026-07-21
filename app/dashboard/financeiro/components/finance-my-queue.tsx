"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { fmtCurrency } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Receipt } from "lucide-react";
import type { FinanceQueueItem } from "@/lib/financeiro/types";

function urgencyLabel(daysOpen: number) {
  if (daysOpen <= 0) return { text: "Hoje", tone: "today" as const };
  if (daysOpen === 1) return { text: "Ontem", tone: "today" as const };
  return { text: `${daysOpen} dias`, tone: "late" as const };
}

function QueueCard({
  item,
  canManage,
  onReceber,
}: {
  item: FinanceQueueItem;
  canManage: boolean;
  onReceber?: (comandaId: string, remainder: number) => void;
}) {
  const urgency = urgencyLabel(item.days_open);
  const href = item.appointment_id
    ? `/dashboard/agenda/consulta/${item.appointment_id}`
    : item.comanda_id
      ? `/dashboard/financeiro/recibo/${item.comanda_id}`
      : null;

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{item.patient_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {item.service_name ?? "Atendimento"}
          </p>
        </div>
        {item.column !== "recebido" && (
          <span
            className={cn(
              "shrink-0 text-xs font-medium inline-flex items-center gap-1",
              urgency.tone === "late" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                urgency.tone === "late" ? "bg-amber-500" : "bg-emerald-500"
              )}
            />
            {urgency.tone === "late" ? `⚠ ${urgency.text}` : `● ${urgency.text}`}
          </span>
        )}
      </div>
      <p className="text-base font-semibold tabular-nums">{fmtCurrency(item.amount)}</p>
      <div className="flex flex-wrap gap-1.5">
        {item.column === "cobrar" && href && (
          <Button size="sm" asChild>
            <Link href={href}>Cobrar</Link>
          </Button>
        )}
        {item.column === "receber" && canManage && item.comanda_id && (
          <Button
            size="sm"
            onClick={() => onReceber?.(item.comanda_id!, item.remainder ?? item.amount)}
          >
            Receber
          </Button>
        )}
        {item.column === "receber" && href && (
          <Button size="sm" variant="ghost" asChild>
            <Link href={href}>Abrir</Link>
          </Button>
        )}
        {item.column === "recebido" && item.comanda_id && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/financeiro/recibo/${item.comanda_id}`}>Recibo</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  count,
  items,
  emptyTitle,
  emptyDescription,
  canManage,
  onReceber,
  seeAllHref,
}: {
  title: string;
  count: number;
  items: FinanceQueueItem[];
  emptyTitle: string;
  emptyDescription: string;
  canManage: boolean;
  onReceber?: (comandaId: string, remainder: number) => void;
  seeAllHref?: string;
}) {
  const shown = items.slice(0, 12);
  const hasMore = items.length > shown.length;

  return (
    <div className="flex flex-col min-h-[280px] rounded-xl border bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        </div>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-xs text-muted-foreground hover:text-foreground">
            Ver todos
          </Link>
        )}
      </div>
      <div className="flex-1 space-y-2 p-2.5 overflow-y-auto max-h-[420px]">
        {shown.length === 0 ? (
          <EmptyState
            icon={title === "Recebido" ? CheckCircle2 : Receipt}
            title={emptyTitle}
            description={emptyDescription}
            className="border-0 bg-transparent py-8"
          />
        ) : (
          shown.map((item) => (
            <QueueCard key={item.id} item={item} canManage={canManage} onReceber={onReceber} />
          ))
        )}
        {hasMore && seeAllHref && (
          <p className="text-center text-xs text-muted-foreground py-1">
            +{items.length - shown.length} —{" "}
            <Link href={seeAllHref} className="underline underline-offset-2">
              ver todos
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function FinanceMyQueue({
  cobrar,
  receber,
  recebido,
  canManage,
  onReceber,
}: {
  cobrar: FinanceQueueItem[];
  receber: FinanceQueueItem[];
  recebido: FinanceQueueItem[];
  canManage: boolean;
  onReceber: (comandaId: string, remainder: number) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Minha fila</h2>
        <p className="text-sm text-muted-foreground">O que precisa ser feito agora.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Column
          title="Cobrar"
          count={cobrar.length}
          items={cobrar}
          emptyTitle="Nenhuma cobrança pendente"
          emptyDescription="As consultas de hoje já foram faturadas."
          canManage={canManage}
          seeAllHref="/dashboard/atendimento"
        />
        <Column
          title="Receber"
          count={receber.length}
          items={receber}
          emptyTitle="Nenhum pagamento pendente"
          emptyDescription="Tudo em dia."
          canManage={canManage}
          onReceber={onReceber}
          seeAllHref="/dashboard/financeiro/receber"
        />
        <Column
          title="Recebido"
          count={recebido.length}
          items={recebido}
          emptyTitle="Ainda não há recebimentos hoje"
          emptyDescription="Quando um pagamento for registrado, aparece aqui."
          canManage={canManage}
          seeAllHref="/dashboard/financeiro/extrato"
        />
      </div>
    </section>
  );
}
