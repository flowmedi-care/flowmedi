"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createFinancialEntry, updateFinancialEntry } from "../actions";
import { EXPENSE_CATEGORIES, RECURRENCE_FREQUENCIES } from "@/lib/financeiro/constants";
import { previewRecurrenceMessage, generateRecurrenceDates } from "@/lib/financeiro/recurrence";
import type {
  ExpenseCategory,
  FinancialEntryRow,
  RecurrenceEndMode,
  RecurrenceFrequency,
  StockLineInput,
} from "@/lib/financeiro/types";
import { listProductsBySupplier } from "@/lib/estoque/stock-from-expense";
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
  const [category, setCategory] = useState<ExpenseCategory>(editEntry?.category ?? "outros");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [intervalCount, setIntervalCount] = useState("1");
  const [endMode, setEndMode] = useState<RecurrenceEndMode>("count");
  const [endCount, setEndCount] = useState("12");
  const [endDate, setEndDate] = useState("");
  const [registerStock, setRegisterStock] = useState(false);
  const [supplierProducts, setSupplierProducts] = useState<
    { id: string; name: string; unit: string; cost: number }[]
  >([]);
  const [stockLines, setStockLines] = useState<
    { product_id: string; quantity: string; unit_cost: string; lot_code: string; expiry_date: string }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supplierId || !registerStock) {
      setSupplierProducts([]);
      return;
    }
    listProductsBySupplier(supplierId).then((res) => {
      if (res.data) setSupplierProducts(res.data);
    });
  }, [supplierId, registerStock]);

  const recurrencePreview = useMemo(() => {
    if (!isRecurring || !dueDate || editEntry) return null;
    const parsed = parseFloat(amount.replace(",", ".")) || 0;
    const dates = generateRecurrenceDates({
      startDate: dueDate,
      frequency,
      interval_count: parseInt(intervalCount) || 1,
      end_mode: endMode,
      end_count: endMode === "count" ? parseInt(endCount) || 1 : null,
      end_date: endMode === "until_date" ? endDate : null,
    });
    return previewRecurrenceMessage(parsed, dates.length, endMode);
  }, [isRecurring, dueDate, amount, frequency, intervalCount, endMode, endCount, endDate, editEntry]);

  function addStockLine() {
    setStockLines((prev) => [
      ...prev,
      { product_id: "", quantity: "1", unit_cost: "", lot_code: "", expiry_date: "" },
    ]);
  }

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

    const stockPayload: StockLineInput[] = registerStock
      ? stockLines
          .filter((l) => l.product_id && parseFloat(l.quantity) > 0)
          .map((l) => ({
            product_id: l.product_id,
            quantity: parseFloat(l.quantity.replace(",", ".")) || 0,
            unit_cost: parseFloat(l.unit_cost.replace(",", ".")) || parsed,
            lot_code: l.lot_code || null,
            expiry_date: l.expiry_date || null,
          }))
      : [];

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
        recurrence: isRecurring
          ? {
              frequency,
              interval_count: parseInt(intervalCount) || 1,
              end_mode: endMode,
              end_count: endMode === "count" ? parseInt(endCount) || 1 : null,
              end_date: endMode === "until_date" ? endDate : null,
            }
          : null,
        register_stock: registerStock,
        stock_lines: stockPayload,
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
      <DialogContent title={editEntry ? "Editar lançamento" : "Novo lançamento"} onClose={() => onOpenChange(false)}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {!editEntry && (
            <div className="flex gap-2">
              <Button type="button" variant={entryType === "receita" ? "default" : "outline"} size="sm" onClick={() => setEntryType("receita")}>
                Receita manual
              </Button>
              <Button type="button" variant={entryType === "despesa" ? "default" : "outline"} size="sm" onClick={() => setEntryType("despesa")}>
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
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required={entryType === "despesa"} />
            </div>
          </div>

          {entryType === "despesa" && (
            <>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria / Classificação DRE</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </div>

              {!editEntry && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={registerStock} onChange={(e) => setRegisterStock(e.target.checked)} />
                  Registrar entrada no estoque ao pagar
                </label>
              )}

              {registerStock && supplierId && (
                <div className="space-y-2 border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <Label>Produtos do fornecedor</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addStockLine}>+ Produto</Button>
                  </div>
                  {stockLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2">
                      <Select
                        value={line.product_id}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const prod = supplierProducts.find((p) => p.id === pid);
                          setStockLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, product_id: pid, unit_cost: prod ? String(prod.cost) : l.unit_cost }
                                : l
                            )
                          );
                        }}
                      >
                        <option value="">Produto…</option>
                        {supplierProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                      <Input placeholder="Qtd" value={line.quantity} onChange={(e) => setStockLines((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} />
                      <Input placeholder="Custo unit." value={line.unit_cost} onChange={(e) => setStockLines((prev) => prev.map((l, i) => i === idx ? { ...l, unit_cost: e.target.value } : l))} />
                      <Input placeholder="Lote (opc.)" value={line.lot_code} onChange={(e) => setStockLines((prev) => prev.map((l, i) => i === idx ? { ...l, lot_code: e.target.value } : l))} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!editEntry && (
            <div className="space-y-3 border rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                Recorrente
              </label>
              {isRecurring && (
                <>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                      {RECURRENCE_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </Select>
                    <Input type="number" min={1} value={intervalCount} onChange={(e) => setIntervalCount(e.target.value)} placeholder="Intervalo" />
                  </div>
                  <Select value={endMode} onChange={(e) => setEndMode(e.target.value as RecurrenceEndMode)}>
                    <option value="count">Número de ocorrências</option>
                    <option value="until_date">Até data</option>
                    <option value="never">Sem fim (cron)</option>
                  </Select>
                  {endMode === "count" && (
                    <Input type="number" min={1} value={endCount} onChange={(e) => setEndCount(e.target.value)} placeholder="Quantas vezes" />
                  )}
                  {endMode === "until_date" && (
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  )}
                  {recurrencePreview && (
                    <p className="text-xs text-muted-foreground">{recurrencePreview}</p>
                  )}
                </>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
