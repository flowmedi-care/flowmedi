// FINANCEIRO — modal de pagamento de cupom (caixa + crédito interno)

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  getComandaPaymentContext,
  registerComandaPayment,
} from "../../agenda/encounter-actions";
import { listBankAccounts, type BankAccountRow } from "../bank-account-actions";
import {
  listAvailablePatientCredits,
  type PatientCreditRow,
} from "../patient-credit-actions";
import { PAYMENT_METHODS } from "@/lib/financeiro/constants";
import { todayDateOnly } from "@/lib/financeiro/date-utils";
import { fmtCurrency } from "@/lib/financeiro/format";
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
  const [credits, setCredits] = useState<PatientCreditRow[]>([]);
  const [useCredit, setUseCredit] = useState(false);
  const [creditId, setCreditId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const open = !!comandaId;

  useEffect(() => {
    if (comandaId && defaultAmount > 0) {
      setAmount(String(defaultAmount));
      setPaidDate(todayDateOnly());
      setUseCredit(false);
      setCreditAmount("");
    }
  }, [comandaId, defaultAmount]);

  useEffect(() => {
    if (!open || !comandaId) return;

    listBankAccounts().then((res) => {
      if (!res.error) {
        setAccounts(res.data);
        const def = res.data.find((a) => a.is_default);
        if (def) setBankAccountId(def.id);
      }
    });

    getComandaPaymentContext(comandaId).then((ctx) => {
      if (ctx.data) {
        listAvailablePatientCredits(ctx.data.patient_id).then((cr) => {
          if (!cr.error && cr.data.length) {
            setCredits(cr.data);
            setCreditId(cr.data[0].id);
          } else {
            setCredits([]);
          }
        });
      }
    });
  }, [open, comandaId]);

  useEffect(() => {
    if (!useCredit || !creditId) return;
    const c = credits.find((x) => x.id === creditId);
    const remainder = parseFloat(amount.replace(",", ".")) || defaultAmount;
    if (c) {
      const maxCredit = Math.min(c.remaining, remainder);
      setCreditAmount(String(maxCredit.toFixed(2)));
      const cash = Math.max(0, remainder - maxCredit);
      setAmount(String(cash.toFixed(2)));
    }
  }, [useCredit, creditId, credits, defaultAmount]);

  async function handlePay() {
    if (!comandaId) return;
    const cashAmt = parseFloat(amount.replace(",", ".")) || 0;
    const creditAmt = useCredit ? parseFloat(creditAmount.replace(",", ".")) || 0 : 0;

    if (cashAmt <= 0 && creditAmt <= 0) {
      toast("Informe valor em dinheiro ou crédito.", "error");
      return;
    }
    if (cashAmt > 0 && !bankAccountId) {
      toast("Selecione a conta bancária.", "error");
      return;
    }

    setSaving(true);
    const res = await registerComandaPayment(comandaId, cashAmt, method, paidDate, {
      bank_account_id: bankAccountId || undefined,
      card_brand: method === "cartao" ? cardBrand : undefined,
      installments: method === "cartao" ? parseInt(installments, 10) || 1 : 1,
      generate_receipt: cashAmt > 0,
      credit_amount: creditAmt > 0 ? creditAmt : undefined,
      credit_id: useCredit && creditAmt > 0 ? creditId : undefined,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      let msg = "Pagamento registrado.";
      if (creditAmt > 0) msg += ` Crédito aplicado: ${fmtCurrency(creditAmt)}.`;
      if (res.receiptNumber) msg += ` Recibo ${res.receiptNumber}.`;
      toast(msg, "success");
      if (res.receiptId) {
        window.open(`/dashboard/financeiro/recibo/${res.receiptId}`, "_blank");
      }
      onClose();
      router.refresh();
    }
  }

  const totalCreditAvailable = credits.reduce((s, c) => s + c.remaining, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Registrar pagamento" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Lente: <strong>Entradas no caixa</strong> — valor bruto recebido (taxa de cartão como despesa separada).
            Crédito interno não entra no caixa.
          </p>

          {totalCreditAvailable > 0 && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">
                Créditos disponíveis: {fmtCurrency(totalCreditAvailable)}
              </p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.target.checked)}
                />
                Usar crédito do paciente
              </label>
              {useCredit && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Crédito</Label>
                    <Select value={creditId} onChange={(e) => setCreditId(e.target.value)}>
                      {credits.map((c) => (
                        <option key={c.id} value={c.id}>
                          {fmtCurrency(c.remaining)} (de {fmtCurrency(c.amount)})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor do crédito (R$)</Label>
                    <Input
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Valor em dinheiro / cartão (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
          {(parseFloat(amount.replace(",", ".")) || 0) > 0 && (
            <>
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
            </>
          )}
          <Button className="w-full" onClick={handlePay} disabled={saving}>
            {saving ? "Registrando…" : "Confirmar pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
