"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createProduct, adjustStock, type ProductRow } from "./actions";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/toast";

export function EstoqueClient({
  initialProducts,
  isAdmin,
}: {
  initialProducts: ProductRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("un");
  const [cost, setCost] = useState("");
  const [initialQty, setInitialQty] = useState("0");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    const res = await createProduct({
      name,
      unit,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      initial_quantity: parseFloat(initialQty.replace(",", ".")) || 0,
    });
    if (res.error) toast(res.error, "error");
    else {
      toast("Produto cadastrado.", "success");
      setShowForm(false);
      setName("");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleAdjust(productId: string, delta: number) {
    const res = await adjustStock(productId, delta, delta > 0 ? "Entrada manual" : "Saída manual");
    if (res.error) toast(res.error, "error");
    else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, quantity_on_hand: Math.max(0, p.quantity_on_hand + delta) }
            : p
        )
      );
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="font-semibold">Produtos e insumos</h2>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo produto
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && isAdmin && (
          <form onSubmit={handleCreate} className="p-4 border rounded-lg space-y-3 bg-muted/30">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="un, ml, cx..." />
              </div>
              <div className="space-y-1">
                <Label>Custo unitário (R$)</Label>
                <Input value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Quantidade inicial</Label>
                <Input value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Cadastrar"}</Button>
          </form>
        )}

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum produto cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Em estoque</th>
                  <th className="py-2 pr-4">Comprometido</th>
                  <th className="py-2 pr-4">Disponível</th>
                  <th className="py-2 pr-4">Custo</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const available = p.quantity_on_hand - p.quantity_committed;
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-medium">{p.name}</td>
                      <td className="py-3 pr-4">{p.quantity_on_hand} {p.unit}</td>
                      <td className="py-3 pr-4 text-amber-700 dark:text-amber-400">{p.quantity_committed}</td>
                      <td className="py-3 pr-4">{available} {p.unit}</td>
                      <td className="py-3 pr-4">
                        {p.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleAdjust(p.id, 1)}>+1</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleAdjust(p.id, -1)}>-1</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
