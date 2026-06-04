// FINANCEIRO FASE 1 — ITEM 1/4: modal de pagamento de comanda

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { registerComandaPayment } from "../../agenda/encounter-actions";
import { PAYMENT_METHODS } from "@/lib/financeiro/constants";
import { todayDateOnly } from "@/lib/financeiro/date-utils";
import { toast } from "@/components/ui/toast";

export function ComandaPaymentDialog({
  comandaId,
  defaultAmount,
  onClose,
}: {
  comandaId: string | null;
  defaultAmount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [paidDate, setPaidDate] = useState(todayDateOnly());
  const [saving, setSaving] = useState(false);

  const open = !!comandaId;

  useEffect(() => {
    if (comandaId && defaultAmount > 0) {
      setAmount(String(defaultAmount));
      setPaidDate(todayDateOnly());
    }
  }, [comandaId, defaultAmount]);

  async function handlePay() {
    if (!comandaId) return;
    const amt = parseFloat(amount.replace(",", ".")) || 0;
    if (amt <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }
    setSaving(true);
    const res = await registerComandaPayment(comandaId, amt, method, paidDate);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Pagamento registrado.", "success");
      onClose();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Registrar pagamento" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Lente: <strong>Entradas no caixa</strong> — movimento real de recebimento.
          </p>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <Button className="w-full" onClick={handlePay} disabled={saving}>
            {saving ? "Registrando…" : "Registrar pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
