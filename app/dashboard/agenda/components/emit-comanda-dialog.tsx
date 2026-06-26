"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  emitComanda,
  getBillingPreview,
  getClinicBillingDefaults,
  type BillingPreview,
  type EmitComandaOptions,
} from "../encounter-actions";
import { listBankAccounts, type BankAccountRow } from "@/app/dashboard/financeiro/bank-account-actions";
import { PAYMENT_METHODS } from "@/lib/financeiro/constants";
import { toast } from "@/components/ui/toast";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EmitComandaDialog({
  appointmentId,
  open,
  onOpenChange,
  onSuccess,
}: {
  appointmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | null>(null);
  const [emitting, setEmitting] = useState(false);
  const [chargeMaterials, setChargeMaterials] = useState(true);
  const [discountMode, setDiscountMode] = useState<"none" | "amount" | "percent">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [bankAccountId, setBankAccountId] = useState("");
  const [cardBrand, setCardBrand] = useState("visa");
  const [installments, setInstallments] = useState("1");
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoadingBilling(true);
    setPaymentAmount("");
    setPaymentExpanded(false);
    setDiscountMode("none");
    setDiscountValue("");
    setNotes("");

    listBankAccounts().then((res) => {
      if (!res.error) {
        setAccounts(res.data);
        const def = res.data.find((a) => a.is_default);
        if (def) setBankAccountId(def.id);
      }
    });

    getClinicBillingDefaults().then((defaults) => {
      const charge = defaults.chargeMaterialsSeparately;
      setChargeMaterials(charge);
      return getBillingPreview(appointmentId, { chargeMaterialsSeparately: charge });
    }).then((res) => {
      if (res?.error) toast(res.error, "error");
      else if (res?.data) setBillingPreview(res.data);
      setLoadingBilling(false);
    });
  }, [open, appointmentId]);

  function buildPreviewOptions(
    materials: boolean,
    mode = discountMode,
    value = discountValue
  ) {
    const opts: {
      chargeMaterialsSeparately?: boolean;
      discountAmount?: number;
      discountPercent?: number;
    } = { chargeMaterialsSeparately: materials };
    const parsed = parseFloat(value.replace(",", ".")) || 0;
    if (mode === "amount" && parsed > 0) opts.discountAmount = parsed;
    if (mode === "percent" && parsed > 0) opts.discountPercent = parsed;
    return opts;
  }

  async function refreshPreview(opts?: ReturnType<typeof buildPreviewOptions>) {
    const res = await getBillingPreview(appointmentId, opts ?? buildPreviewOptions(chargeMaterials));
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    if (res.data) setBillingPreview(res.data);
  }

  function buildEmitOptions(payment: number): EmitComandaOptions {
    const opts: EmitComandaOptions = {
      chargeMaterialsSeparately: chargeMaterials,
      notes: notes.trim() || null,
      paymentAmount: payment,
      paymentMethod: payment > 0 ? paymentMethod : undefined,
    };
    const parsed = parseFloat(discountValue.replace(",", ".")) || 0;
    if (discountMode === "amount" && parsed > 0) opts.discountAmount = parsed;
    if (discountMode === "percent" && parsed > 0) opts.discountPercent = parsed;
    if (payment > 0) {
      opts.bank_account_id = bankAccountId || undefined;
      if (paymentMethod === "cartao") {
        opts.card_brand = cardBrand;
        opts.installments = parseInt(installments, 10) || 1;
      }
    }
    return opts;
  }

  async function handleEmit(paymentOverride?: number) {
    const payment =
      paymentOverride ?? (parseFloat(paymentAmount.replace(",", ".")) || 0);
    if (payment > 0 && !bankAccountId) {
      toast("Selecione a conta bancária para registrar o pagamento.", "error");
      return;
    }
    setEmitting(true);
    const res = await emitComanda(appointmentId, buildEmitOptions(payment));
    setEmitting(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast(
      payment > 0 ? "Comanda emitida e pagamento registrado." : "Comanda emitida.",
      "success"
    );
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Finalizar comanda"
        onClose={() => onOpenChange(false)}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-4">
          {loadingBilling ? (
            <p className="text-sm text-muted-foreground">Calculando totais…</p>
          ) : billingPreview ? (
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              {billingPreview.serviceName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Serviço — {billingPreview.serviceName}
                  </span>
                  <span>{fmt(billingPreview.serviceAmount)}</span>
                </div>
              )}
              {chargeMaterials &&
                billingPreview.materialLines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {l.name} × {l.quantity}
                    </span>
                    <span>{fmt(l.line_total)}</span>
                  </div>
                ))}
              {!chargeMaterials && billingPreview.materialsAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Insumos ({fmt(billingPreview.materialsAmount)}) não serão cobrados.
                </p>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(billingPreview.subtotalAmount)}</span>
              </div>
              {billingPreview.discountAmount > 0 && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Desconto</span>
                  <span>-{fmt(billingPreview.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total da comanda</span>
                <span>{fmt(billingPreview.totalAmount)}</span>
              </div>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={chargeMaterials}
              onChange={async (e) => {
                const checked = e.target.checked;
                setChargeMaterials(checked);
                setLoadingBilling(true);
                await refreshPreview(buildPreviewOptions(checked));
                setLoadingBilling(false);
              }}
              className="rounded border"
            />
            Cobrar insumos separadamente
          </label>

          <div className="space-y-2">
            <Label>Desconto no total</Label>
            <div className="flex gap-2">
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={discountMode}
                onChange={async (e) => {
                  const mode = e.target.value as "none" | "amount" | "percent";
                  setDiscountMode(mode);
                  setLoadingBilling(true);
                  await refreshPreview(buildPreviewOptions(chargeMaterials, mode, discountValue));
                  setLoadingBilling(false);
                }}
              >
                <option value="none">Sem desconto</option>
                <option value="amount">Valor (R$)</option>
                <option value="percent">Percentual (%)</option>
              </select>
              {discountMode !== "none" && (
                <Input
                  className="h-9 flex-1"
                  value={discountValue}
                  onChange={async (e) => {
                    setDiscountValue(e.target.value);
                    setLoadingBilling(true);
                    await refreshPreview(
                      buildPreviewOptions(chargeMaterials, discountMode, e.target.value)
                    );
                    setLoadingBilling(false);
                  }}
                  placeholder={discountMode === "percent" ? "10" : "50,00"}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="border rounded-lg">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/50"
              onClick={() => setPaymentExpanded((v) => !v)}
            >
              Receber pagamento agora {paymentExpanded ? "▾" : "▸"}
            </button>
            {paymentExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t">
                <div className="space-y-1 pt-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={billingPreview ? String(billingPreview.totalAmount) : "0"}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Forma de pagamento</Label>
                  <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {accounts.length > 0 && (
                  <div className="space-y-1">
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
                {paymentMethod === "cartao" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Bandeira</Label>
                      <Select value={cardBrand} onChange={(e) => setCardBrand(e.target.value)}>
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="elo">Elo</option>
                        <option value="amex">Amex</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Parcelas</Label>
                      <Input
                        value={installments}
                        onChange={(e) => setInstallments(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => handleEmit(0)}
              disabled={emitting}
              variant="outline"
            >
              {emitting ? "Finalizando…" : "Finalizar comanda"}
            </Button>
            {paymentExpanded && (
              <Button className="w-full" onClick={() => handleEmit()} disabled={emitting}>
                {emitting ? "Processando…" : "Emitir e receber"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
