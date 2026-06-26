"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createScheduleComanda,
  getComandaDetail,
  type AppointmentComandaSummary,
  type ComandaDetail,
} from "../encounter-actions";
import { ComandaPaymentDialog } from "@/app/dashboard/financeiro/components/comanda-payment-dialog";
import { EmitComandaDialog } from "./emit-comanda-dialog";
import { toast } from "@/components/ui/toast";
import { CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/financeiro/constants";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function paymentMethodLabel(method: string | null) {
  if (!method) return "—";
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function ComandaBillingPanel({
  appointmentId,
  canEdit,
  comanda,
  onRefresh,
  autoOpenEmit = false,
}: {
  appointmentId: string;
  canEdit: boolean;
  comanda: AppointmentComandaSummary | null;
  onRefresh: () => void;
  autoOpenEmit?: boolean;
}) {
  const router = useRouter();
  const [emitOpen, setEmitOpen] = useState(false);
  const [paymentComandaId, setPaymentComandaId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ComandaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoEmitDone, setAutoEmitDone] = useState(false);

  const isComandaFinalized = !!comanda?.issued_at;
  const canFinalize = canEdit && !isComandaFinalized;
  const canPay = canEdit && isComandaFinalized && (comanda?.remainder ?? 0) > 0;
  const isPaid = comanda?.status === "paga" || (comanda?.remainder ?? 0) <= 0;

  const loadDetail = useCallback(async () => {
    if (!comanda?.id || !comanda.issued_at) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    const res = await getComandaDetail(comanda.id);
    if (res.data) setDetail(res.data);
    setLoadingDetail(false);
  }, [comanda?.id, comanda?.issued_at]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!autoOpenEmit || autoEmitDone || !canEdit) return;
    if (!comanda?.issued_at) {
      setAutoEmitDone(true);
      setEmitOpen(true);
    }
  }, [autoOpenEmit, autoEmitDone, canEdit, comanda?.issued_at]);

  async function handleGenerateComanda() {
    setGenerating(true);
    const res = await createScheduleComanda(appointmentId);
    setGenerating(false);
    if (res.error) toast(res.error, "error");
    else if (!res.comandaId) {
      toast(
        "Vincule um serviço com valor na consulta (Serviços e Valores) ou finalize direto pelo botão abaixo.",
        "error"
      );
      setEmitOpen(true);
    } else {
      toast("Comanda provisória criada.", "success");
      onRefresh();
    }
  }

  function handleBillingSuccess() {
    onRefresh();
    router.refresh();
  }

  return (
    <>
      <Card id="comanda-billing-panel">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Cobrança
          </h3>
          <div className="flex flex-wrap gap-2">
            {!comanda && canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateComanda}
                  disabled={generating}
                >
                  {generating ? "Gerando…" : "Gerar comanda"}
                </Button>
                <Button variant="default" size="sm" onClick={() => setEmitOpen(true)}>
                  Finalizar comanda
                </Button>
              </>
            )}
            {comanda && canFinalize && (
              <Button variant="default" size="sm" onClick={() => setEmitOpen(true)}>
                Finalizar comanda
              </Button>
            )}
            {canPay && comanda && (
              <Button variant="default" size="sm" onClick={() => setPaymentComandaId(comanda.id)}>
                Receber pagamento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {!comanda && (
            <p className="text-muted-foreground">
              Nenhuma comanda vinculada. Gere uma comanda provisória ou finalize direto para emitir
              a cobrança.
            </p>
          )}

          {comanda && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isComandaFinalized ? "secondary" : "outline"}>
                  {isComandaFinalized ? `Comanda ${comanda.status}` : "Comanda provisória"}
                </Badge>
                {isPaid && isComandaFinalized && (
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Quitada
                  </Badge>
                )}
              </div>

              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{fmt(comanda.total_amount)}</span>
                </div>
                {comanda.discount_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Desconto</span>
                    <span>-{fmt(comanda.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pago</span>
                  <span>{fmt(comanda.paid_amount)}</span>
                </div>
                {comanda.remainder > 0 && (
                  <p className="text-amber-700 dark:text-amber-400 text-xs pt-1">
                    Saldo em contas a receber: {fmt(comanda.remainder)}
                  </p>
                )}
              </div>

              {isComandaFinalized && (
                <div className="space-y-2">
                  {loadingDetail ? (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando itens…
                    </p>
                  ) : detail ? (
                    <>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Itens da comanda
                      </p>
                      <ul className="divide-y rounded-md border text-sm">
                        {detail.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2 px-3 py-2">
                            <span>
                              {item.description} × {item.quantity}
                            </span>
                            <span className="shrink-0">{fmt(item.total_price)}</span>
                          </li>
                        ))}
                      </ul>
                      {detail.payments.length > 0 && (
                        <>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                            Pagamentos registrados
                          </p>
                          <ul className="divide-y rounded-md border text-sm">
                            {detail.payments.map((p) => (
                              <li
                                key={p.id}
                                className="flex justify-between gap-2 px-3 py-2 text-xs"
                              >
                                <span>
                                  {new Date(p.paid_at).toLocaleDateString("pt-BR")} ·{" "}
                                  {paymentMethodLabel(p.payment_method)}
                                </span>
                                <span>{fmt(p.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {!isComandaFinalized && (
                <p className="text-xs text-muted-foreground">
                  Finalize a comanda para registrar pagamento e gerar contas a receber.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <EmitComandaDialog
        appointmentId={appointmentId}
        open={emitOpen}
        onOpenChange={setEmitOpen}
        onSuccess={handleBillingSuccess}
      />

      <ComandaPaymentDialog
        comandaId={paymentComandaId}
        defaultAmount={comanda?.remainder ?? 0}
        onClose={() => {
          setPaymentComandaId(null);
          handleBillingSuccess();
        }}
      />
    </>
  );
}
