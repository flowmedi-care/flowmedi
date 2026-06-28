"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  deactivateBankAccount,
  deactivatePaymentFeeRule,
  listAllBankAccounts,
  listPaymentFeeRules,
  setDefaultBankAccount,
  upsertBankAccount,
  upsertPaymentFeeRule,
  type BankAccountRow,
  type PaymentFeeRuleRow,
} from "@/app/dashboard/financeiro/bank-account-actions";
import { toast } from "@/components/ui/toast";
import { Building2, CreditCard, Pencil, Plus, Star, Trash2 } from "lucide-react";

type AccountForm = {
  id?: string;
  name: string;
  bank_name: string;
  agency: string;
  account_number: string;
  is_default: boolean;
};

const emptyAccountForm = (): AccountForm => ({
  name: "",
  bank_name: "",
  agency: "",
  account_number: "",
  is_default: false,
});

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
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm());
  const [saving, setSaving] = useState(false);
  const [installments, setInstallments] = useState("1");
  const [feePercent, setFeePercent] = useState("2.5");
  const [cardBrand, setCardBrand] = useState("visa");

  useEffect(() => {
    setAccounts(initialAccounts);
    setFeeRules(initialFeeRules);
  }, [initialAccounts, initialFeeRules]);

  function openNewAccount() {
    setAccountForm(emptyAccountForm());
    setAccountDialogOpen(true);
  }

  function openEditAccount(account: BankAccountRow) {
    setAccountForm({
      id: account.id,
      name: account.name,
      bank_name: account.bank_name ?? "",
      agency: account.agency ?? "",
      account_number: account.account_number ?? "",
      is_default: account.is_default,
    });
    setAccountDialogOpen(true);
  }

  async function refreshLists() {
    router.refresh();
    const [accRes, feeRes] = await Promise.all([listAllBankAccounts(), listPaymentFeeRules()]);
    if (!accRes.error) setAccounts(accRes.data);
    if (!feeRes.error) setFeeRules(feeRes.data);
  }

  async function saveAccount() {
    if (!accountForm.name.trim()) {
      toast("Informe um nome para a conta.", "error");
      return;
    }
    setSaving(true);
    const res = await upsertBankAccount({
      id: accountForm.id,
      name: accountForm.name,
      bank_name: accountForm.bank_name,
      agency: accountForm.agency,
      account_number: accountForm.account_number,
      is_default: accountForm.is_default || accounts.length === 0,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast(accountForm.id ? "Conta atualizada." : "Conta criada.", "success");
      setAccountDialogOpen(false);
      await refreshLists();
    }
  }

  async function handleSetDefault(id: string) {
    setSaving(true);
    const res = await setDefaultBankAccount(id);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Conta padrão definida.", "success");
      await refreshLists();
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`Desativar a conta "${name}"? Lançamentos antigos permanecem vinculados.`)) return;
    setSaving(true);
    const res = await deactivateBankAccount(id);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Conta desativada.", "success");
      await refreshLists();
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
      await refreshLists();
    }
  }

  async function removeFeeRule(id: string) {
    setSaving(true);
    const res = await deactivatePaymentFeeRule(id);
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Taxa removida.", "success");
      await refreshLists();
    }
  }

  const activeAccounts = accounts.filter((a) => a.active);
  const inactiveAccounts = accounts.filter((a) => !a.active);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Contas bancárias
            </CardTitle>
            <CardDescription className="mt-1.5">
              Vincule recebimentos e pagamentos à conta de destino para refletir o caixa real da
              clínica.
            </CardDescription>
          </div>
          <Button onClick={openNewAccount} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Nova conta
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma conta cadastrada. Adicione a primeira conta para usar no financeiro.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-xl border bg-card p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{account.name}</p>
                        {account.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Padrão
                          </Badge>
                        )}
                      </div>
                      {account.bank_name && (
                        <p className="text-sm text-muted-foreground mt-0.5">{account.bank_name}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditAccount(account)}
                        disabled={saving}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!account.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(account.id, account.name)}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {account.agency && <p>Agência: {account.agency}</p>}
                    {account.account_number && <p>Conta: {account.account_number}</p>}
                  </div>
                  {!account.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleSetDefault(account.id)}
                      disabled={saving}
                    >
                      Definir como padrão
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {inactiveAccounts.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Contas inativas</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {inactiveAccounts.map((a) => (
                  <li key={a.id}>
                    {a.name}
                    {a.bank_name ? ` · ${a.bank_name}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-primary" />
            Taxas de cartão (MDR)
          </CardTitle>
          <CardDescription>
            Percentual descontado do valor bruto; o caixa registra o valor líquido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feeRules.length > 0 && (
            <div className="rounded-lg border divide-y">
              {feeRules.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium capitalize">{r.card_brand ?? "Cartão"}</span>
                    <span className="text-muted-foreground"> · {r.installments}x</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{r.fee_percent}%</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFeeRule(r.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3 border-t pt-4">
            <div className="space-y-1">
              <Label>Bandeira</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm bg-background"
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

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent
          title={accountForm.id ? "Editar conta" : "Nova conta bancária"}
          onClose={() => setAccountDialogOpen(false)}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome / apelido *</Label>
              <Input
                value={accountForm.name}
                onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Conta principal"
              />
            </div>
            <div className="space-y-1">
              <Label>Banco</Label>
              <Input
                value={accountForm.bank_name}
                onChange={(e) => setAccountForm((f) => ({ ...f, bank_name: e.target.value }))}
                placeholder="Ex.: Banco do Brasil"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Agência</Label>
                <Input
                  value={accountForm.agency}
                  onChange={(e) => setAccountForm((f) => ({ ...f, agency: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Input
                  value={accountForm.account_number}
                  onChange={(e) =>
                    setAccountForm((f) => ({ ...f, account_number: e.target.value }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={accountForm.is_default}
                onChange={(e) =>
                  setAccountForm((f) => ({ ...f, is_default: e.target.checked }))
                }
              />
              Definir como conta padrão
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAccount} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
