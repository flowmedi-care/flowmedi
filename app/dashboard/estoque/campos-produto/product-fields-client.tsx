"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  upsertProductFieldDefinition,
  type ProductFieldDefinition,
} from "@/app/dashboard/estoque/product-field-actions";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export function ProductFieldsClient({ initialFields }: { initialFields: ProductFieldDefinition[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "number" | "date" | "boolean">("text");
  const [requiredForLot, setRequiredForLot] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!slug.trim() || !label.trim()) {
      toast("Informe slug e rótulo.", "error");
      return;
    }
    setSaving(true);
    const res = await upsertProductFieldDefinition({
      slug,
      label,
      field_type: fieldType,
      required_for_lot: requiredForLot,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Campo salvo.", "success");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Campos definidos</h2>
        </CardHeader>
        <CardContent>
          {initialFields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum campo customizado.</p>
          ) : (
            <ul className="divide-y text-sm">
              {initialFields.map((f) => (
                <li key={f.id} className="py-2 flex justify-between">
                  <span>
                    {f.label} <span className="text-muted-foreground">({f.slug})</span>
                  </span>
                  <span className="text-muted-foreground">{f.field_type}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Novo campo</h2>
        </CardHeader>
        <CardContent className="space-y-3 max-w-md">
          <div className="space-y-1">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="registro_anvisa" />
          </div>
          <div className="space-y-1">
            <Label>Rótulo</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Registro ANVISA" />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <select
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as typeof fieldType)}
            >
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="date">Data</option>
              <option value="boolean">Sim/Não</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiredForLot}
              onChange={(e) => setRequiredForLot(e.target.checked)}
            />
            Obrigatório ao cadastrar lote
          </label>
          <Button onClick={handleAdd} disabled={saving}>
            Salvar campo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
