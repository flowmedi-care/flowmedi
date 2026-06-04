// FINANCEIRO FASE 1 — ITEM 5: modal de cancelamento de comanda

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelComanda } from "../../agenda/encounter-actions";
import { fmtCurrency } from "@/lib/financeiro/format";
import { toast } from "@/components/ui/toast";

export function CancelComandaDialog({
  comanda,
  onClose,
}: {
  comanda: {
    id: string;
    patient_name: string;
    total_amount: number;
    paid_amount: number;
  } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!comanda) return;
    setSaving(true);
    const res = await cancelComanda(comanda.id, reason);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Comanda cancelada.", "success");
      onClose();
      router.refresh();
    }
  }

  const paid = comanda?.paid_amount ?? 0;

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

            {paid > 0 && (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                Esta comanda tem {fmtCurrency(paid)} já recebido. O cancelamento não reverte
                pagamentos automaticamente — registre o estorno manualmente se necessário.
              </p>
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
