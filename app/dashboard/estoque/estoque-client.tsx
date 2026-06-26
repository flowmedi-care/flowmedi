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
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

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
  const [salePrice, setSalePrice] = useState("");
  const [initialQty, setInitialQty] = useState("0");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    const parsedSale = salePrice.trim() ? parseFloat(salePrice.replace(",", ".")) : null;
    const res = await createProduct({
      name,
      unit,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      sale_price: parsedSale != null && !Number.isNaN(parsedSale) ? parsedSale : null,
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
                <Label>Preço de venda ao paciente (R$)</Label>
                <Input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Opcional — usado na comanda"
                />
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
          <EmptyState title="Nenhum produto cadastrado" />
        ) : (
          <DataTable
            columns={[
              { key: "name", header: "Produto", cell: (p) => <span className="font-medium">{p.name}</span> },
              {
                key: "stock",
                header: "Em estoque",
                cell: (p) => `${p.quantity_on_hand} ${p.unit}`,
              },
              {
                key: "committed",
                header: "Comprometido",
                cell: (p) => (
                  <span className="text-amber-700 dark:text-amber-400">
                    {p.quantity_committed} {p.unit}
                  </span>
                ),
              },
              {
                key: "available",
                header: "Disponível",
                cell: (p) => {
                  const available = p.quantity_on_hand - p.quantity_committed;
                  const lowStock = available <= 0 && p.quantity_committed > 0;
                  return (
                    <span className={cn(lowStock && "text-red-600 dark:text-red-400 font-medium")}>
                      {available} {p.unit}
                    </span>
                  );
                },
              },
              {
                key: "cost",
                header: "Custo",
                cell: (p) => p.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              },
              {
                key: "sale",
                header: "Venda",
                cell: (p) =>
                  p.sale_price != null
                    ? p.sale_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—",
              },
              {
                key: "actions",
                header: "Ações",
                cell: (p) => (
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleAdjust(p.id, 1)}>
                      +1
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleAdjust(p.id, -1)}>
                      -1
                    </Button>
                  </div>
                ),
              },
            ]}
            data={products}
            getRowKey={(p) => p.id}
          />
        )}
      </CardContent>
    </Card>
  );
}
