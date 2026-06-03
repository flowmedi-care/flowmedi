"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createFinancialEntry, markEntryPaid, type FinancialEntryRow } from "./actions";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function FinanceiroClient({
  initialEntries,
  summary,
  canManage,
}: {
  initialEntries: FinancialEntryRow[];
  summary: { recebido: number; aReceber: number; pago: number; aPagar: number };
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

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <h2 className="font-semibold">Lançamentos</h2>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          )}
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

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento ainda.</p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 gap-2">
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.entry_type === "receita" ? "Receita" : "Despesa"} · {e.status}
                      {e.supplier_name && ` · ${e.supplier_name}`}
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
    </div>
  );
}
