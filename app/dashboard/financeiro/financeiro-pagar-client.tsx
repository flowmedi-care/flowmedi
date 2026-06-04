// FINANCEIRO FASE 1 — ITEM 3: contas a pagar

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { markEntryPaid } from "./actions";
import { FinancialEntryFormDialog } from "./components/financial-entry-form-dialog";
import { fmtCurrency } from "@/lib/financeiro/format";
import { CATEGORY_LABELS } from "@/lib/financeiro/constants";
import { PAYMENT_METHODS } from "@/lib/financeiro/constants";
import { todayDateOnly } from "@/lib/financeiro/date-utils";
import type { ExpenseGroupKey, FinancialEntryRow, PendingExpenseRow } from "@/lib/financeiro/types";
import { toast } from "@/components/ui/toast";

const GROUP_LABELS: Record<ExpenseGroupKey, { title: string; className: string }> = {
  vencidas: { title: "Vencidas", className: "text-destructive" },
  hoje_amanha: { title: "Vence hoje/amanhã", className: "text-amber-700 dark:text-amber-400" },
  proximos_7: { title: "Próximos 7 dias", className: "text-muted-foreground" },
  futuras: { title: "Futuras", className: "text-muted-foreground" },
};

type SupplierOption = { id: string; name: string };

export function FinanceiroPagarClient({
  expenses,
  suppliers,
  canManage,
}: {
  expenses: PendingExpenseRow[];
  suppliers: SupplierOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<FinancialEntryRow | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(todayDateOnly());
  const [payMethod, setPayMethod] = useState("pix");
  const [saving, setSaving] = useState(false);

  const groups = (["vencidas", "hoje_amanha", "proximos_7", "futuras"] as ExpenseGroupKey[]).map(
    (key) => ({
      key,
      items: expenses.filter((e) => e.group === key),
      total: expenses.filter((e) => e.group === key).reduce((s, e) => s + e.amount, 0),
    })
  );

  async function handleMarkPaid() {
    if (!payId) return;
    setSaving(true);
    const res = await markEntryPaid(payId, { paid_at: payDate, payment_method: payMethod });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Despesa marcada como paga.", "success");
      setPayId(null);
      router.refresh();
    }
  }

  function openEdit(row: PendingExpenseRow) {
    setEditEntry({
      id: row.id,
      entry_type: "despesa",
      origin: "supplier",
      description: row.description,
      amount: row.amount,
      due_date: row.due_date,
      paid_at: null,
      status: row.status,
      supplier_name: row.supplier_display_name,
      supplier_id: row.supplier_id,
      supplier_display_name: row.supplier_display_name,
      patient_id: null,
      comanda_id: null,
      category: row.category,
      payment_method: null,
      created_at: "",
      lens: "manual",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova despesa
          </Button>
        )}
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma despesa pendente.
          </CardContent>
        </Card>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <Card key={g.key}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className={`font-semibold ${GROUP_LABELS[g.key].className}`}>
                    {GROUP_LABELS[g.key].title}
                  </h2>
                  <span className="text-sm font-medium">{fmtCurrency(g.total)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-2">Fornecedor</th>
                        <th className="pb-2 pr-2">Descrição</th>
                        <th className="pb-2 pr-2">Categoria</th>
                        <th className="pb-2 pr-2 text-right">Valor</th>
                        <th className="pb-2 pr-2">Vencimento</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="py-3 pr-2">{row.supplier_display_name}</td>
                          <td className="py-3 pr-2">{row.description}</td>
                          <td className="py-3 pr-2">
                            {row.category ? CATEGORY_LABELS[row.category] : "—"}
                          </td>
                          <td className="py-3 pr-2 text-right">{fmtCurrency(row.amount)}</td>
                          <td className="py-3 pr-2">
                            {row.due_date
                              ? new Date(row.due_date + "T12:00:00").toLocaleDateString("pt-BR")
                              : "—"}
                          </td>
                          <td className="py-3 text-right space-x-1">
                            {canManage && (
                              <>
                                <Button size="sm" onClick={() => setPayId(row.id)}>
                                  Marcar como paga
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                                  Editar
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {g.items.map((row) => (
                    <div key={row.id} className="border rounded-lg p-3 space-y-2">
                      <p className="font-medium">{row.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.supplier_display_name} · {fmtCurrency(row.amount)}
                      </p>
                      {canManage && (
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => setPayId(row.id)}>
                            Pagar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
      )}

      {canManage && (
        <>
          <FinancialEntryFormDialog
            open={showForm}
            onOpenChange={setShowForm}
            suppliers={suppliers}
            defaultType="despesa"
          />
          <FinancialEntryFormDialog
            open={!!editEntry}
            onOpenChange={(o) => !o && setEditEntry(null)}
            suppliers={suppliers}
            editEntry={editEntry}
          />
          <Dialog open={!!payId} onOpenChange={(o) => !o && setPayId(null)}>
            <DialogContent title="Marcar despesa como paga" onClose={() => setPayId(null)}>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Lente: <strong>Saídas no caixa</strong>
                </p>
                <div className="space-y-2">
                  <Label>Data do pagamento</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Método</Label>
                  <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button className="w-full" onClick={handleMarkPaid} disabled={saving}>
                  {saving ? "Salvando…" : "Confirmar pagamento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
