"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  listBankAccounts,
  upsertBankAccount,
  listPaymentFeeRules,
  upsertPaymentFeeRule,
  type BankAccountRow,
  type PaymentFeeRuleRow,
} from "@/app/dashboard/financeiro/bank-account-actions";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ContasBancariasClient({
  initialAccounts,
  initialFeeRules,
}: {
  initialAccounts: BankAccountRow[];
  initialFeeRules: PaymentFeeRuleRow[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [feeRules, setFeeRules] = useState(initialFeeRules);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [agency, setAgency] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [installments, setInstallments] = useState("1");
  const [feePercent, setFeePercent] = useState("2.5");
  const [cardBrand, setCardBrand] = useState("visa");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccounts(initialAccounts);
    setFeeRules(initialFeeRules);
  }, [initialAccounts, initialFeeRules]);

  async function addAccount() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await upsertBankAccount({
      name,
      bank_name: bankName,
      agency,
      account_number: accountNumber,
      is_default: accounts.length === 0,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Conta salva.", "success");
      setName("");
      setBankName("");
      setAgency("");
      setAccountNumber("");
      router.refresh();
      listBankAccounts().then((r) => !r.error && setAccounts(r.data));
    }
  }

  async function addFeeRule() {
    setSaving(true);
    const res = await upsertPaymentFeeRule({
      card_brand: cardBrand,
      installments: parseInt(installments, 10) || 1,
      fee_percent: parseFloat(feePercent.replace(",", ".")) || 0,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Taxa salva.", "success");
      router.refresh();
      listPaymentFeeRules().then((r) => !r.error && setFeeRules(r.data));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Contas bancárias</h2>
          <p className="text-sm text-muted-foreground">
            Vincule recebimentos à conta de destino para refletir o caixa real da clínica.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y text-sm">
            {accounts.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-2">
                <span>
                  <span className="font-medium">{a.name}</span>
                  {a.bank_name && (
                    <span className="text-muted-foreground ml-2">{a.bank_name}</span>
                  )}
                  {a.is_default && (
                    <span className="text-xs ml-2 text-primary">(padrão)</span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {a.agency && `Ag ${a.agency} `}
                  {a.account_number}
                </span>
              </li>
            ))}
            {accounts.length === 0 && (
              <li className="py-4 text-muted-foreground">Nenhuma conta cadastrada.</li>
            )}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2 border-t pt-4">
            <div className="space-y-1">
              <Label>Nome / apelido</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Banco</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Agência</Label>
              <Input value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Conta</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
          </div>
          <Button onClick={addAccount} disabled={saving}>
            Adicionar conta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Taxas de cartão (MDR)</h2>
          <p className="text-sm text-muted-foreground">
            Percentual descontado do valor bruto; o caixa registra o valor líquido.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y text-sm">
            {feeRules.map((r) => (
              <li key={r.id} className="py-2 flex justify-between">
                <span>
                  {r.card_brand ?? "Cartão"} · {r.installments}x
                </span>
                <span>{r.fee_percent}%</span>
              </li>
            ))}
            {feeRules.length === 0 && (
              <li className="py-4 text-muted-foreground">Nenhuma taxa configurada.</li>
            )}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3 border-t pt-4">
            <div className="space-y-1">
              <Label>Bandeira</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={cardBrand}
                onChange={(e) => setCardBrand(e.target.value)}
              >
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="elo">Elo</option>
                <option value="amex">Amex</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Parcelas</Label>
              <Input value={installments} onChange={(e) => setInstallments(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Taxa (%)</Label>
              <Input value={feePercent} onChange={(e) => setFeePercent(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" onClick={addFeeRule} disabled={saving}>
            Adicionar taxa
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
