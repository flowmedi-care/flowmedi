"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createProduct, adjustStock, type ProductRow } from "./actions";
import { Plus, Package } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { fmtCurrency } from "@/lib/financeiro/format";

type SupplierOption = { id: string; name: string };

export function EstoqueCategoryClient({
  categoryName,
  categoryId,
  initialProducts,
  suppliers,
  isAdmin,
}: {
  categoryName: string;
  categoryId: string;
  initialProducts: ProductRow[];
  suppliers: SupplierOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("un");
  const [cost, setCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [initialQty, setInitialQty] = useState("0");
  const [supplierId, setSupplierId] = useState("");
  const [minQty, setMinQty] = useState("0");
  const [trackLot, setTrackLot] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [lotCode, setLotCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    const parsedSale = salePrice.trim() ? parseFloat(salePrice.replace(",", ".")) : null;
    const res = await createProduct({
      name,
      sku: sku || null,
      unit,
      cost: parseFloat(cost.replace(",", ".")) || 0,
      sale_price: parsedSale != null && !Number.isNaN(parsedSale) ? parsedSale : null,
      initial_quantity: parseFloat(initialQty.replace(",", ".")) || 0,
      category_id: categoryId,
      supplier_id: supplierId || null,
      image_url: imageUrl || null,
      track_lot: trackLot,
      track_expiry: trackExpiry,
      min_quantity: parseFloat(minQty.replace(",", ".")) || 0,
      lot_code: trackLot ? lotCode : null,
      expiry_date: trackExpiry ? expiryDate : null,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{categoryName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{products.length} produtos nesta categoria</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo produto
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Card>
          <CardHeader><h2 className="font-semibold">Novo produto</h2></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Custo (R$)</Label>
                <Input value={cost} onChange={(e) => setCost(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Preço venda (R$)</Label>
                <Input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Nenhum</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Qtd inicial</Label>
                <Input value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Estoque mínimo</Label>
                <Input value={minQty} onChange={(e) => setMinQty(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>URL da foto</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={trackLot} onChange={(e) => setTrackLot(e.target.checked)} />
                Controlar lote
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={trackExpiry} onChange={(e) => setTrackExpiry(e.target.checked)} />
                Controlar validade
              </label>
              {trackLot && (
                <div className="space-y-1">
                  <Label>Código do lote</Label>
                  <Input value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
                </div>
              )}
              {trackExpiry && (
                <div className="space-y-1">
                  <Label>Validade</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Cadastrar"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {products.length === 0 ? (
        <EmptyState title="Nenhum produto" description="Adicione produtos nesta categoria." />
      ) : (
        <DataTable
          columns={[
            {
              key: "photo",
              header: "",
              cell: (p) =>
                p.image_url ? (
                  <Image src={p.image_url} alt="" width={40} height={40} className="rounded object-cover" unoptimized />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                ),
            },
            {
              key: "name",
              header: "Produto",
              cell: (p) => (
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.sku && <p className="text-xs text-muted-foreground">SKU {p.sku}</p>}
                </div>
              ),
            },
            { key: "supplier", header: "Fornecedor", cell: (p) => p.supplier_name ?? "—" },
            { key: "on_hand", header: "Em estoque", className: "text-right", cell: (p) => `${p.quantity_on_hand} ${p.unit}` },
            { key: "committed", header: "Comprometido", className: "text-right", cell: (p) => p.quantity_committed },
            { key: "cost", header: "Custo", className: "text-right", cell: (p) => fmtCurrency(p.cost) },
            {
              key: "flags",
              header: "Controles",
              cell: (p) => (
                <div className="flex gap-1">
                  {p.track_lot && <Badge variant="secondary">Lote</Badge>}
                  {p.track_expiry && <Badge variant="secondary">Validade</Badge>}
                </div>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              cell: (p) => (
                <div className="space-x-1">
                  <Button size="sm" variant="outline" onClick={() => handleAdjust(p.id, 1)}>+1</Button>
                  <Button size="sm" variant="outline" onClick={() => handleAdjust(p.id, -1)}>−1</Button>
                </div>
              ),
            },
          ]}
          data={products}
          getRowKey={(p) => p.id}
        />
      )}
    </div>
  );
}
