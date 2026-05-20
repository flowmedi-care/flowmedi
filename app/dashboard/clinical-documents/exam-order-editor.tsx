"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import { listExamCatalog } from "./actions";
import type { ExamCatalogItem, ExamOrderLine } from "@/lib/clinical-documents/types";

export function ExamOrderEditor({
  examLines,
  examNotes,
  onLinesChange,
  onNotesChange,
}: {
  examLines: ExamOrderLine[];
  examNotes: string;
  onLinesChange: (lines: ExamOrderLine[]) => void;
  onNotesChange: (notes: string) => void;
}) {
  const [catalog, setCatalog] = useState<ExamCatalogItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listExamCatalog().then((r) => {
      if (!r.error) setCatalog(r.data);
    });
  }, []);

  const filtered = catalog.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function addFromCatalog(item: ExamCatalogItem) {
    onLinesChange([
      ...examLines,
      { catalogId: item.id, name: item.name, details: "" },
    ]);
  }

  function addManual() {
    onLinesChange([...examLines, { name: "", details: "" }]);
  }

  function updateLine(index: number, patch: Partial<ExamOrderLine>) {
    const next = [...examLines];
    next[index] = { ...next[index], ...patch };
    onLinesChange(next);
  }

  function removeLine(index: number) {
    onLinesChange(examLines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Adicionar exame do catálogo</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Cadastre exames em Meu Perfil. Depois de adicionar, descreva o que solicitar (ex.: no
          hemograma, quais parâmetros ou observações).
        </p>
        <Input
          placeholder="Buscar exame..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 border rounded-lg bg-muted/20">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum exame no catálogo.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addFromCatalog(c)}
                className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                + {c.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Exames neste pedido</Label>
        {examLines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg mt-2">
            Adicione exames pelo catálogo ou manualmente.
          </p>
        ) : (
          <ul className="space-y-3 mt-2">
            {examLines.map((line, i) => (
              <li
                key={`${line.catalogId ?? "m"}-${i}`}
                className="p-4 border rounded-xl bg-card space-y-2 relative"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => removeLine(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Input
                  value={line.name}
                  onChange={(e) => updateLine(i, { name: e.target.value })}
                  placeholder="Nome do exame (ex.: Hemograma)"
                  className="font-medium pr-10"
                />
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Detalhes / o que solicitar neste exame
                  </Label>
                  <Textarea
                    value={line.details}
                    onChange={(e) => updateLine(i, { details: e.target.value })}
                    rows={3}
                    placeholder="Ex.: hemograma completo; incluir VHS e plaquetas; jejum de 8h..."
                    className="mt-1 text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addManual}>
          <Plus className="h-4 w-4 mr-1" />
          Exame manual (sem catálogo)
        </Button>
      </div>

      <div>
        <Label htmlFor="exam-notes-global">Observações gerais do pedido (opcional)</Label>
        <Textarea
          id="exam-notes-global"
          value={examNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          placeholder="Jejum, urgência, preparo..."
          className="mt-1"
        />
      </div>
    </div>
  );
}
