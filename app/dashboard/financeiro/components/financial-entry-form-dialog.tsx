// FINANCEIRO FASE 1 — ITEM 2: formulário de lançamento

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createFinancialEntry, updateFinancialEntry } from "../actions";
import { EXPENSE_CATEGORIES } from "@/lib/financeiro/constants";
import type { ExpenseCategory, FinancialEntryRow } from "@/lib/financeiro/types";
import { toast } from "@/components/ui/toast";

type SupplierOption = { id: string; name: string };

export function FinancialEntryFormDialog({
  open,
  onOpenChange,
  suppliers,
  editEntry,
  defaultType = "despesa",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  editEntry?: FinancialEntryRow | null;
  defaultType?: "receita" | "despesa";
}) {
  const router = useRouter();
  const [entryType, setEntryType] = useState<"receita" | "despesa">(
    editEntry?.entry_type ?? defaultType
  );
  const [description, setDescription] = useState(editEntry?.description ?? "");
  const [amount, setAmount] = useState(editEntry ? String(editEntry.amount) : "");
  const [supplierId, setSupplierId] = useState(editEntry?.supplier_id ?? "");
  const [dueDate, setDueDate] = useState(editEntry?.due_date?.slice(0, 10) ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(
    editEntry?.category ?? "outros"
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", ".")) || 0;
    if (parsed <= 0) {
      toast("Informe um valor válido.", "error");
      return;
    }
    if (entryType === "despesa" && !dueDate) {
      toast("Informe o vencimento da despesa.", "error");
      return;
    }

    setSaving(true);
    let res: { error: string | null };
    if (editEntry) {
      res = await updateFinancialEntry(editEntry.id, {
        description,
        amount: parsed,
        due_date: dueDate || null,
        supplier_id: supplierId || null,
        category: entryType === "despesa" ? category : null,
      });
    } else {
      res = await createFinancialEntry({
        entry_type: entryType,
        origin: entryType === "despesa" ? "supplier" : "manual",
        description,
        amount: parsed,
        due_date: dueDate || null,
        supplier_id: supplierId || null,
        category: entryType === "despesa" ? category : null,
      });
    }
    setSaving(false);

    if (res.error) toast(res.error, "error");
    else {
      toast(editEntry ? "Lançamento atualizado." : "Lançamento criado.", "success");
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editEntry ? "Editar lançamento" : "Novo lançamento"}
        onClose={() => onOpenChange(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editEntry && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={entryType === "receita" ? "default" : "outline"}
                size="sm"
                onClick={() => setEntryType("receita")}
              >
                Receita manual
              </Button>
              <Button
                type="button"
                variant={entryType === "despesa" ? "default" : "outline"}
                size="sm"
                onClick={() => setEntryType("despesa")}
              >
                Despesa
              </Button>
            </div>
          )}

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
              <Label>{entryType === "despesa" ? "Vencimento *" : "Vencimento"}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required={entryType === "despesa"}
              />
            </div>
          </div>

          {entryType === "despesa" && (
            <>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
