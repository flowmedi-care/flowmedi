"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createFinancialEntry, markEntryPaid, type FinancialEntryRow } from "./actions";
import {
  registerComandaPayment,
  getComandaDetail,
  type ComandaDetail,
} from "../agenda/encounter-actions";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/toast";

type OpenComanda = {
  id: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  remainder: number;
  created_at: string;
  patient_name: string;
  scheduled_at: string | null;
};

export function FinanceiroClient({
  initialEntries,
  summary,
  openComandas,
  canManage,
}: {
  initialEntries: FinancialEntryRow[];
  summary: { recebido: number; aReceber: number; pago: number; aPagar: number };
  openComandas: OpenComanda[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [entryType, setEntryType] = useState<"receita" | "despesa">("despesa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [entryFilter, setEntryFilter] = useState<"all" | "receita" | "despesa" | "pendente">("all");
  const [paymentComandaId, setPaymentComandaId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [detailComanda, setDetailComanda] = useState<ComandaDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await createFinancialEntry({
      entry_type: entryType,
      origin: entryType === "despesa" ? "supplier" : "manual",
      description,
      amount: parseFloat(amount.replace(",", ".")) || 0,
      due_date: dueDate || null,
      supplier_name: supplierName || null,
    });
    if (res.error) toast(res.error, "error");
    else {
      toast("Lançamento criado.", "success");
      setShowForm(false);
      router.refresh();
    }
  }

  async function openComandaDetail(comandaId: string) {
    setLoadingDetail(true);
    setDetailOpen(true);
    const res = await getComandaDetail(comandaId);
    setLoadingDetail(false);
    if (res.error || !res.data) {
      toast(res.error ?? "Erro ao carregar comanda.", "error");
      setDetailOpen(false);
      return;
    }
    setDetailComanda(res.data);
  }

  async function handleComandaPayment() {
    if (!paymentComandaId) return;
    const amt = parseFloat(paymentAmount.replace(",", ".")) || 0;
    if (amt <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }
    const res = await registerComandaPayment(paymentComandaId, amt, paymentMethod);
    if (res.error) toast(res.error, "error");
    else {
      toast("Pagamento registrado.", "success");
      setPaymentComandaId(null);
      setPaymentAmount("");
      router.refresh();
    }
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const filteredEntries = entries.filter((e) => {
    if (entryFilter === "receita") return e.entry_type === "receita";
    if (entryFilter === "despesa") return e.entry_type === "despesa";
    if (entryFilter === "pendente") return e.status === "pendente";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-xl font-semibold text-green-700 dark:text-green-400">{fmt(summary.recebido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">A receber</p>
            <p className="text-xl font-semibold">{fmt(summary.aReceber)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-xl font-semibold">{fmt(summary.pago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">A pagar</p>
            <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">{fmt(summary.aPagar)}</p>
          </CardContent>
        </Card>
      </div>

      {openComandas.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Contas a receber (comandas)</h2>
            <p className="text-sm text-muted-foreground">
              Comandas abertas ou parciais com saldo pendente de pacientes.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {openComandas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between py-3 gap-2">
                  <div>
                    <p className="font-medium">{c.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.scheduled_at
                        ? new Date(c.scheduled_at).toLocaleDateString("pt-BR")
                        : new Date(c.created_at).toLocaleDateString("pt-BR")}
                      {" · "}
                      {c.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {fmt(c.paid_amount)} / {fmt(c.total_amount)}
                      <span className="text-amber-700 dark:text-amber-400 ml-1">
                        (falta {fmt(c.remainder)})
                      </span>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => openComandaDetail(c.id)}>
                      Ver itens
                    </Button>
                    {canManage && (
                      <Button size="sm" onClick={() => {
                        setPaymentComandaId(c.id);
                        setPaymentAmount(String(c.remainder));
                      }}>
                        Receber
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row justify-between items-center flex-wrap gap-2">
          <h2 className="font-semibold">Lançamentos</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={entryFilter}
              onChange={(e) => setEntryFilter(e.target.value as typeof entryFilter)}
            >
              <option value="all">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
              <option value="pendente">Pendentes</option>
            </select>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && canManage && (
            <form onSubmit={handleCreate} className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <div className="flex gap-2">
                <Button type="button" variant={entryType === "receita" ? "default" : "outline"} size="sm" onClick={() => setEntryType("receita")}>Receita</Button>
                <Button type="button" variant={entryType === "despesa" ? "default" : "outline"} size="sm" onClick={() => setEntryType("despesa")}>Despesa</Button>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              {entryType === "despesa" && (
                <div className="space-y-1">
                  <Label>Fornecedor</Label>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                </div>
              )}
              <Button type="submit">Salvar</Button>
            </form>
          )}

          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento ainda.</p>
          ) : (
            <ul className="divide-y">
              {filteredEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 gap-2">
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.entry_type === "receita" ? "Receita" : "Despesa"} · {e.status}
                      {e.supplier_name && ` · ${e.supplier_name}`}
                      {e.due_date && ` · Venc. ${new Date(e.due_date).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={e.entry_type === "receita" ? "text-green-700 dark:text-green-400" : ""}>
                      {fmt(e.amount)}
                    </p>
                    {e.status === "pendente" && canManage && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => markEntryPaid(e.id).then(() => router.refresh())}>
                        Marcar pago
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!paymentComandaId} onOpenChange={(o) => !o && setPaymentComandaId(null)}>
        <DialogContent title="Registrar pagamento" onClose={() => setPaymentComandaId(null)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <select
                className="h-9 w-full rounded-md border px-3 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <Button className="w-full" onClick={handleComandaPayment}>
              Registrar pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent title="Detalhes da comanda" onClose={() => setDetailOpen(false)} className="max-w-md">
          {loadingDetail ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : detailComanda ? (
            <div className="space-y-4">
              <p className="text-sm">
                Status: <span className="font-medium">{detailComanda.status}</span>
              </p>
              <ul className="divide-y text-sm">
                {detailComanda.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-2">
                    <span>
                      {item.description} × {item.quantity}
                    </span>
                    <span>{fmt(item.total_price)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{fmt(detailComanda.total_amount)}</span>
              </div>
              {detailComanda.payments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Pagamentos</p>
                  <ul className="text-sm space-y-1">
                    {detailComanda.payments.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{new Date(p.paid_at).toLocaleDateString("pt-BR")}</span>
                        <span>{fmt(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
