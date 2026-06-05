// FINANCEIRO FASE 1 — modal de cancelamento de cupom

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelComanda,
  type CancellationType,
} from "../../agenda/encounter-actions";
import { fmtCurrency } from "@/lib/financeiro/format";
import { toast } from "@/components/ui/toast";

export function CancelComandaDialog({
  comanda,
  userRole,
  onClose,
}: {
  comanda: {
    id: string;
    patient_name: string;
    total_amount: number;
    paid_amount: number;
    status?: string;
  } | null;
  userRole?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [cancellationType, setCancellationType] = useState<CancellationType | "">("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!comanda) return;
    const paid = comanda.paid_amount ?? 0;
    if (paid > 0 && !cancellationType) {
      toast("Escolha estorno, crédito ou perda para o valor recebido.", "error");
      return;
    }
    setSaving(true);
    const res = await cancelComanda(comanda.id, {
      reason,
      cancellationType: cancellationType || undefined,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Comanda cancelada.", "success");
      onClose();
      router.refresh();
    }
  }

  const paid = comanda?.paid_amount ?? 0;
  const isPaidComanda = comanda?.status === "paga";

  return (
    <Dialog open={!!comanda} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Cancelar comanda" onClose={onClose}>
        {comanda && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Paciente:</span> {comanda.patient_name}
              </p>
              <p>
                <span className="text-muted-foreground">Total:</span>{" "}
                {fmtCurrency(comanda.total_amount)}
              </p>
              <p>
                <span className="text-muted-foreground">Já recebido:</span>{" "}
                {fmtCurrency(comanda.paid_amount)}
              </p>
            </div>

            {isPaidComanda && (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                Esta comanda está quitada. Confirme apenas se deseja cancelar mesmo assim.
              </p>
            )}

            {paid > 0 && (
              <div className="space-y-2">
                <Label>O que fazer com {fmtCurrency(paid)} já recebido?</Label>
                <div className="space-y-2 text-sm">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancellationType"
                      value="estorno"
                      checked={cancellationType === "estorno"}
                      onChange={() => setCancellationType("estorno")}
                      disabled={userRole !== "admin"}
                      className="mt-1"
                    />
                    <span>
                      <strong>Estorno</strong> — saída no caixa (somente admin)
                      {userRole !== "admin" && (
                        <span className="text-muted-foreground block text-xs">
                          Peça a um administrador para estornar.
                        </span>
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancellationType"
                      value="credito"
                      checked={cancellationType === "credito"}
                      onChange={() => setCancellationType("credito")}
                      className="mt-1"
                    />
                    <span>
                      <strong>Crédito</strong> — saldo para o paciente usar depois
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancellationType"
                      value="perda"
                      checked={cancellationType === "perda"}
                      onChange={() => setCancellationType("perda")}
                      className="mt-1"
                    />
                    <span>
                      <strong>Perda</strong> — mantém o valor no caixa (sem devolução)
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Motivo (opcional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Voltar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleConfirm} disabled={saving}>
                {saving ? "Cancelando…" : "Confirmar cancelamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
