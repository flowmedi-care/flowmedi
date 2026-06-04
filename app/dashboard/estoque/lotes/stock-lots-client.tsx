"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  upsertStockLot,
  type StockLotRow,
} from "@/app/dashboard/estoque/product-field-actions";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export function StockLotsClient({ initialLots }: { initialLots: StockLotRow[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [expiry, setExpiry] = useState("");
  const [qty, setQty] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!productId.trim() || !lotCode.trim()) {
      toast("Informe produto e lote.", "error");
      return;
    }
    setSaving(true);
    const res = await upsertStockLot({
      product_id: productId.trim(),
      lot_code: lotCode.trim(),
      expiry_date: expiry || null,
      quantity_on_hand: parseFloat(qty.replace(",", ".")) || 0,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Lote salvo.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Lotes em estoque</h2>
        </CardHeader>
        <CardContent>
          {initialLots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lote cadastrado.</p>
          ) : (
            <ul className="divide-y text-sm">
              {initialLots.map((l) => (
                <li key={l.id} className="py-2 flex justify-between gap-2">
                  <span>
                    <span className="font-medium">{l.product_name}</span>
                    <span className="text-muted-foreground ml-2">Lote {l.lot_code}</span>
                  </span>
                  <span className="text-right text-xs">
                    {l.quantity_on_hand} un.
                    {l.expiry_date && (
                      <span className="block text-muted-foreground">
                        Val: {new Date(l.expiry_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Cadastrar lote</h2>
        </CardHeader>
        <CardContent className="space-y-3 max-w-md">
          <div className="space-y-1">
            <Label>ID do produto (UUID)</Label>
            <Input value={productId} onChange={(e) => setProductId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Código do lote</Label>
            <Input value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Validade</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Quantidade</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button onClick={handleAdd} disabled={saving}>
            Salvar lote
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
