// FINANCEIRO FASE 1 — ITEM 3: contas a pagar

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { PageToolbar } from "@/components/dashboard-ui/page-toolbar";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

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
      <PageToolbar>
        {canManage && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova despesa
          </Button>
        )}
      </PageToolbar>

      {expenses.length === 0 ? (
        <EmptyState title="Nenhuma despesa pendente" />
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
                <DataTable
                  columns={[
                    { key: "supplier", header: "Fornecedor", cell: (row) => row.supplier_display_name },
                    {
                      key: "desc",
                      header: "Descrição",
                      cell: (row) => (
                        <div className="flex items-center gap-2">
                          <span>{row.description}</span>
                          {row.is_recurring && (
                            <Badge variant="secondary" className="text-xs">Recorrente</Badge>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "cat",
                      header: "Categoria",
                      cell: (row) => (row.category ? CATEGORY_LABELS[row.category] : "—"),
                    },
                    {
                      key: "amount",
                      header: "Valor",
                      className: "text-right",
                      cell: (row) => fmtCurrency(row.amount),
                    },
                    {
                      key: "due",
                      header: "Vencimento",
                      cell: (row) =>
                        row.due_date
                          ? new Date(row.due_date + "T12:00:00").toLocaleDateString("pt-BR")
                          : "—",
                    },
                    {
                      key: "actions",
                      header: "",
                      className: "text-right",
                      cell: (row) =>
                        canManage ? (
                          <div className="space-x-1">
                            <Button size="sm" onClick={() => setPayId(row.id)}>
                              Marcar como paga
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                              Editar
                            </Button>
                          </div>
                        ) : null,
                    },
                  ]}
                  data={g.items}
                  getRowKey={(row) => row.id}
                />
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
