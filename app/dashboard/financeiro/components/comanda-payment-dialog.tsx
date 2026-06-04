// FINANCEIRO — modal de pagamento de comanda / cupom

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { registerComandaPayment } from "../../agenda/encounter-actions";
import { listBankAccounts, type BankAccountRow } from "../bank-account-actions";
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
  const [bankAccountId, setBankAccountId] = useState("");
  const [cardBrand, setCardBrand] = useState("visa");
  const [installments, setInstallments] = useState("1");
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [saving, setSaving] = useState(false);

  const open = !!comandaId;

  useEffect(() => {
    if (comandaId && defaultAmount > 0) {
      setAmount(String(defaultAmount));
      setPaidDate(todayDateOnly());
    }
  }, [comandaId, defaultAmount]);

  useEffect(() => {
    if (open) {
      listBankAccounts().then((res) => {
        if (!res.error) {
          setAccounts(res.data);
          const def = res.data.find((a) => a.is_default);
          if (def) setBankAccountId(def.id);
        }
      });
    }
  }, [open]);

  async function handlePay() {
    if (!comandaId) return;
    const amt = parseFloat(amount.replace(",", ".")) || 0;
    if (amt <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }
    setSaving(true);
    const res = await registerComandaPayment(comandaId, amt, method, paidDate, {
      bank_account_id: bankAccountId || undefined,
      card_brand: method === "cartao" ? cardBrand : undefined,
      installments: method === "cartao" ? parseInt(installments, 10) || 1 : 1,
      generate_receipt: true,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      const msg = res.receiptNumber
        ? `Pagamento registrado. Recibo ${res.receiptNumber}.`
        : "Pagamento registrado.";
      toast(msg, "success");
      if (res.receiptId) {
        window.open(`/dashboard/financeiro/recibo/${res.receiptId}`, "_blank");
      }
      onClose();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Registrar pagamento" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Lente: <strong>Entradas no caixa</strong> — valor líquido após taxa de cartão, se houver.
          </p>
          <div className="space-y-2">
            <Label>Valor bruto (R$)</Label>
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
          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Conta bancária</Label>
              <Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                <option value="">— Selecionar —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {method === "cartao" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Select value={cardBrand} onChange={(e) => setCardBrand(e.target.value)}>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="elo">Elo</option>
                  <option value="amex">Amex</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Input value={installments} onChange={(e) => setInstallments(e.target.value)} />
              </div>
            </div>
          )}
          <Button className="w-full" onClick={handlePay} disabled={saving}>
            {saving ? "Registrando…" : "Registrar e emitir recibo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
