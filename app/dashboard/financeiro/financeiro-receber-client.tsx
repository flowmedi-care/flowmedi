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
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma comanda aguardando pagamento.
            </p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2">Paciente</th>
                      <th className="pb-2 pr-2">Consulta</th>
                      <th className="pb-2 pr-2">Serviço</th>
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
                        <td className="py-3 pr-2">{c.service_name ?? "—"}</td>
                        <td className="py-3 pr-2 text-right">{fmtCurrency(c.total_amount)}</td>
                        <td className="py-3 pr-2 text-right">{fmtCurrency(c.paid_amount)}</td>
                        <td className="py-3 pr-2 text-right font-medium">{fmtCurrency(c.remainder)}</td>
                        <td className={cn("py-3 pr-2 text-right", riskClass(c.days_open))}>
                          {c.days_open}
                        </td>
                        <td className="py-3 text-right space-x-1">
                          {canManage && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => setPayComanda({ id: c.id, remainder: c.remainder })}
                              >
                                Receber
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
                      Saldo {fmtCurrency(c.remainder)} ·{" "}
                      <span className={riskClass(c.days_open)}>{c.days_open} dias</span>
                    </p>
                    {canManage && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => setPayComanda({ id: c.id, remainder: c.remainder })}
                      >
                        Receber
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
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
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma receita manual pendente.
            </p>
          ) : (
            <ul className="divide-y">
              {manualReceitas.map((r) => {
                const days = r.due_date ? daysOpenSince(r.due_date) : daysOpenSince(r.created_at);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between py-3 gap-2">
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
                  </li>
                );
              })}
            </ul>
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
