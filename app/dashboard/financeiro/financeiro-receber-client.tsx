// FINANCEIRO FASE 1 — ITEM 4: contas a receber

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ComandaPaymentDialog } from "./components/comanda-payment-dialog";
import { CancelComandaDialog } from "./components/cancel-comanda-dialog";
import { markEntryReceived } from "./actions";
import { fmtCurrency } from "@/lib/financeiro/format";
import { daysOpenSince } from "@/lib/financeiro/date-utils";
import type { FinancialEntryRow, OpenComandaRow } from "@/lib/financeiro/types";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";

function riskClass(days: number) {
  if (days > 60) return "text-destructive font-semibold";
  if (days > 30) return "text-amber-700 dark:text-amber-400 font-medium";
  return "";
}

export function FinanceiroReceberClient({
  openComandas,
  manualReceitas,
  canManage,
  userRole,
}: {
  openComandas: OpenComandaRow[];
  manualReceitas: FinancialEntryRow[];
  canManage: boolean;
  userRole?: string;
}) {
  const router = useRouter();
  const [payComanda, setPayComanda] = useState<{ id: string; remainder: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OpenComandaRow | null>(null);

  async function handleMarkReceived(id: string) {
    const res = await markEntryReceived(id);
    if (res.error) toast(res.error, "error");
    else {
      toast("Receita marcada como recebida.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Saldo de comandas abertas</h2>
          <p className="text-sm text-muted-foreground">
            Fonte primária de contas a receber — pacientes com comanda aberta ou parcial.
          </p>
        </CardHeader>
        <CardContent>
          {openComandas.length === 0 ? (
            <EmptyState title="Nenhuma comanda aguardando pagamento" />
          ) : (
            <DataTable
              columns={[
                { key: "patient", header: "Paciente", cell: (c) => <span className="font-medium">{c.patient_name}</span> },
                {
                  key: "date",
                  header: "Consulta",
                  cell: (c) =>
                    c.scheduled_at
                      ? new Date(c.scheduled_at).toLocaleDateString("pt-BR")
                      : new Date(c.created_at).toLocaleDateString("pt-BR"),
                },
                { key: "service", header: "Serviço", cell: (c) => c.service_name ?? "—" },
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
                  className: "text-right font-medium",
                  cell: (c) => fmtCurrency(c.remainder),
                },
                {
                  key: "days",
                  header: "Dias",
                  className: cn("text-right", ""),
                  cell: (c) => <span className={riskClass(c.days_open)}>{c.days_open}</span>,
                },
                {
                  key: "actions",
                  header: "",
                  className: "text-right",
                  cell: (c) =>
                    canManage ? (
                      <div className="space-x-1">
                        <Button size="sm" onClick={() => setPayComanda({ id: c.id, remainder: c.remainder })}>
                          Receber
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

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Receitas manuais pendentes</h2>
          <p className="text-sm text-muted-foreground">
            Lançamentos manuais ainda não recebidos — separados do saldo de comandas.
          </p>
        </CardHeader>
        <CardContent>
          {manualReceitas.length === 0 ? (
            <EmptyState title="Nenhuma receita manual pendente" />
          ) : (
            <ListPanel>
              {manualReceitas.map((r) => {
                const days = r.due_date ? daysOpenSince(r.due_date) : daysOpenSince(r.created_at);
                return (
                  <ListPanelItem key={r.id}>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.due_date
                            ? `Venc. ${new Date(r.due_date + "T12:00:00").toLocaleDateString("pt-BR")}`
                            : "Sem vencimento"}{" "}
                          · {days} dias
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-700 dark:text-green-400">
                          {fmtCurrency(r.amount)}
                        </span>
                        {canManage && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkReceived(r.id)}>
                            Marcar como recebida
                          </Button>
                        )}
                      </div>
                    </div>
                  </ListPanelItem>
                );
              })}
            </ListPanel>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
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
