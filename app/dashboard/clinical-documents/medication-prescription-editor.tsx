"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { listMedicationCatalog } from "./actions";
import type { MedicationCatalogItem, MedicationItem } from "@/lib/clinical-documents/types";
import { cn } from "@/lib/utils";

export function MedicationPrescriptionEditor({
  medications,
  onChange,
}: {
  medications: MedicationItem[];
  onChange: (items: MedicationItem[]) => void;
}) {
  const [catalog, setCatalog] = useState<MedicationCatalogItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listMedicationCatalog().then((r) => {
      if (!r.error) setCatalog(r.data);
    });
  }, []);

  const filtered = catalog.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function addFromCatalog(item: MedicationCatalogItem) {
    onChange([
      ...medications,
      {
        name: item.name,
        dosage: item.default_dosage,
        quantity: item.default_quantity,
        instructions: item.default_instructions,
      },
    ]);
  }

  function update(i: number, field: keyof MedicationItem, value: string) {
    const next = [...medications];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function remove(i: number) {
    onChange(medications.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Adicionar do seu catálogo</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Cadastre medicamentos em Meu Perfil. Clique para incluir na receita.
        </p>
        <Input
          placeholder="Buscar medicamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg bg-muted/20">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum medicamento no catálogo.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addFromCatalog(c)}
                className={cn(
                  "text-left text-xs px-3 py-1.5 rounded-full border bg-background",
                  "hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                )}
              >
                + {c.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Medicamentos na receita</Label>
        {medications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
            Nenhum medicamento adicionado. Use o catálogo acima.
          </p>
        ) : (
          <ul className="space-y-3 mt-2">
            {medications.map((m, i) => (
              <li
                key={i}
                className="p-4 border rounded-xl bg-card shadow-sm space-y-2 relative"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => remove(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="font-semibold text-primary pr-8">{m.name || "Sem nome"}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Dosagem"
                    value={m.dosage}
                    onChange={(e) => update(i, "dosage", e.target.value)}
                    className="h-9"
                  />
                  <Input
                    placeholder="Quantidade"
                    value={m.quantity}
                    onChange={(e) => update(i, "quantity", e.target.value)}
                    className="h-9"
                  />
                </div>
                <Input
                  placeholder="Posologia / instruções"
                  value={m.instructions}
                  onChange={(e) => update(i, "instructions", e.target.value)}
                  className="h-9"
                />
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() =>
            onChange([
              ...medications,
              { name: "", dosage: "", quantity: "", instructions: "" },
            ])
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Medicamento manual (sem catálogo)
        </Button>
      </div>
    </div>
  );
}
