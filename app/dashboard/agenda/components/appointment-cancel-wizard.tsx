"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getAppointmentCancelPreview,
  applyAppointmentStatusChange,
  type AppointmentCancelPreview,
} from "../appointment-status-change";
import type { CancellationType } from "../encounter-actions";
import { fmtCurrency } from "@/lib/financeiro/format";
import { toast } from "@/components/ui/toast";
import { AlertTriangle, Package } from "lucide-react";

export function AppointmentCancelWizard({
  appointmentId,
  targetStatus,
  open,
  onOpenChange,
  onComplete,
  userRole,
}: {
  appointmentId: string | null;
  targetStatus: "cancelada" | "falta" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  userRole?: string;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<AppointmentCancelPreview | null>(null);
  const [reason, setReason] = useState("");
  const [cancellationType, setCancellationType] = useState<CancellationType | "">("");
  const [applyNoShowFee, setApplyNoShowFee] = useState(false);

  useEffect(() => {
    if (!open || !appointmentId || !targetStatus) {
      setPreview(null);
      setStep(1);
      setReason("");
      setCancellationType("");
      setApplyNoShowFee(false);
      return;
    }
    setLoading(true);
    getAppointmentCancelPreview(appointmentId).then((res) => {
      setLoading(false);
      if (res.error) toast(res.error, "error");
      else if (res.data) {
        setPreview(res.data);
        if (
          targetStatus === "falta" &&
          res.data.noShowFee.resolvedAmount > 0 &&
          res.data.noShowFee.mode !== "none"
        ) {
          setApplyNoShowFee(true);
        }
      }
    });
  }, [open, appointmentId, targetStatus]);

  async function handleConfirm() {
    if (!appointmentId || !targetStatus || !preview) return;

    const paid = preview.comanda?.paid_amount ?? 0;
    const needsCancellationType = paid > 0;

    if (needsCancellationType && !cancellationType) {
      toast("Escolha estorno, crédito ou perda para o valor recebido.", "error");
      return;
    }

    if (cancellationType === "estorno" && userRole !== "admin") {
      toast("Somente administrador pode registrar estorno no caixa.", "error");
      return;
    }

    setSaving(true);
    const res = await applyAppointmentStatusChange({
      appointmentId,
      targetStatus,
      reason,
      cancellationType: cancellationType || undefined,
      applyNoShowFee: targetStatus === "falta" ? applyNoShowFee : false,
    });
    setSaving(false);

    if (res.error) toast(res.error, "error");
    else {
      toast(
        targetStatus === "falta"
          ? applyNoShowFee && preview.noShowFee.resolvedAmount > 0
            ? "Falta registrada com taxa de no-show."
            : "Falta registrada."
          : "Consulta cancelada.",
        "success"
      );
      onOpenChange(false);
      onComplete?.();
    }
  }

  const title =
    targetStatus === "falta" ? "Registrar falta" : "Cancelar consulta";
  const paid = preview?.comanda?.paid_amount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} onClose={() => onOpenChange(false)} className="max-w-md">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {!loading && preview && step === 1 && (
          <div className="space-y-4">
            <div className="text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Paciente:</span> {preview.patientName}
              </p>
              <p>
                <span className="text-muted-foreground">Data:</span>{" "}
                {new Date(preview.scheduledAt).toLocaleString("pt-BR")}
              </p>
              {preview.comanda && (
                <div className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">Comanda</p>
                  <p>
                    Status: {preview.comanda.issued_at ? preview.comanda.status : "provisória"}
                  </p>
                  <p>Total: {fmtCurrency(preview.comanda.total_amount)}</p>
                  <p>Recebido: {fmtCurrency(preview.comanda.paid_amount)}</p>
                </div>
              )}
              {!preview.comanda && (
                <p className="text-muted-foreground">Nenhuma comanda vinculada.</p>
              )}
              {(preview.stockCommitted || preview.stockConsumed) && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 shrink-0 mt-0.5" />
                  {preview.stockConsumed
                    ? "Estoque já consumido — não será revertido."
                    : "Estoque comprometido será liberado."}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <Button onClick={() => setStep(2)}>Continuar</Button>
            </div>
          </div>
        )}

        {!loading && preview && step === 2 && targetStatus === "falta" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Taxa de falta (no-show)</p>
            {preview.noShowFee.resolvedAmount > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Taxa configurada: {fmtCurrency(preview.noShowFee.resolvedAmount)}
                </p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="noShowFee"
                    checked={applyNoShowFee}
                    onChange={() => setApplyNoShowFee(true)}
                  />
                  Cobrar taxa de falta
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="noShowFee"
                    checked={!applyNoShowFee}
                    onChange={() => setApplyNoShowFee(false)}
                  />
                  Não cobrar (mesmo fluxo de cancelamento)
                </label>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma taxa de falta configurada. A comanda será cancelada e o estoque liberado.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  if (paid > 0) setStep(3);
                  else void handleConfirm();
                }}
              >
                {paid > 0 ? "Continuar" : "Confirmar falta"}
              </Button>
            </div>
          </div>
        )}

        {!loading && preview && step === 2 && targetStatus === "cancelada" && (
          <div className="space-y-4">
            {paid > 0 ? (
              <>
                <div className="flex gap-2 text-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p>
                    Há {fmtCurrency(paid)} recebido. Escolha como tratar esse valor antes de
                    cancelar.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Valor recebido</Label>
                  <select
                    className="h-9 w-full rounded-md border px-3 text-sm"
                    value={cancellationType}
                    onChange={(e) =>
                      setCancellationType(e.target.value as CancellationType | "")
                    }
                  >
                    <option value="">— Selecionar —</option>
                    <option value="estorno">Estorno no caixa (admin)</option>
                    <option value="credito">Crédito interno para o paciente</option>
                    <option value="perda">Perda (manter valor recebido)</option>
                  </select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                A comanda será cancelada e contas a receber encerradas, se houver.
              </p>
            )}
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? "Processando…" : "Confirmar cancelamento"}
              </Button>
            </div>
          </div>
        )}

        {!loading && preview && step === 3 && (
          <div className="space-y-4">
            {paid > 0 && (
              <>
                <div className="flex gap-2 text-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p>
                    Há {fmtCurrency(paid)} recebido na comanda atual. Defina o tratamento antes de
                    {applyNoShowFee ? " aplicar a taxa de falta." : " concluir."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Valor recebido</Label>
                  <select
                    className="h-9 w-full rounded-md border px-3 text-sm"
                    value={cancellationType}
                    onChange={(e) =>
                      setCancellationType(e.target.value as CancellationType | "")
                    }
                  >
                    <option value="">— Selecionar —</option>
                    <option value="estorno">Estorno no caixa (admin)</option>
                    <option value="credito">Crédito interno para o paciente</option>
                    <option value="perda">Perda (manter valor recebido)</option>
                  </select>
                </div>
              </>
            )}
            {applyNoShowFee && preview.noShowFee.resolvedAmount > 0 && (
              <p className="text-sm">
                Será emitida comanda de{" "}
                <strong>{fmtCurrency(preview.noShowFee.resolvedAmount)}</strong> por taxa de
                falta.
              </p>
            )}
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep(targetStatus === "falta" ? 2 : 1)}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? "Processando…" : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
