"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedOverride, setExpandedOverride] = useState<Record<number, boolean>>({});

  useEffect(() => {
    listExamCatalog().then((r) => {
      if (!r.error) setCatalog(r.data);
    });
  }, []);

  const filtered = catalog.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const alreadyAdded = new Set(examLines.map((l) => l.catalogId).filter(Boolean));

  function addFromCatalog(item: ExamCatalogItem) {
    onLinesChange([
      ...examLines,
      {
        catalogId: item.id,
        name: item.name,
        details: item.default_details?.trim() ?? "",
      },
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
        <Label className="text-sm font-medium">Adicionar exames do catálogo</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Os detalhes vêm do cadastro em Meu Perfil. Aqui você só escolhe quais exames entram neste
          pedido.
        </p>
        <Input
          placeholder="Buscar exame..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg bg-muted/20">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum exame no catálogo.</p>
          ) : (
            filtered.map((c) => {
              const added = alreadyAdded.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={added}
                  onClick={() => addFromCatalog(c)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title={c.default_details?.trim() || undefined}
                >
                  + {c.name}
                  {added ? " ✓" : ""}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Exames neste pedido</Label>
        {examLines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg mt-2">
            Adicione exames pelo catálogo acima.
          </p>
        ) : (
          <ul className="space-y-3 mt-2">
            {examLines.map((line, i) => (
              <li
                key={`${line.catalogId ?? "m"}-${i}`}
                className="p-4 border rounded-xl bg-card relative"
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
                <p className="font-semibold text-primary pr-8">{line.name || "Sem nome"}</p>
                {line.details.trim() ? (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                    {line.details}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-2">
                    Sem detalhes — edite o exame em Meu Perfil ou ajuste abaixo.
                  </p>
                )}
                <button
                  type="button"
                  className="text-xs text-primary mt-2 flex items-center gap-1"
                  onClick={() =>
                    setExpandedOverride((prev) => ({ ...prev, [i]: !prev[i] }))
                  }
                >
                  {expandedOverride[i] ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  Ajuste só para este pedido (opcional)
                </button>
                {expandedOverride[i] && (
                  <Textarea
                    value={line.details}
                    onChange={(e) => updateLine(i, { details: e.target.value })}
                    rows={3}
                    className="mt-2 text-sm"
                  />
                )}
                {!line.catalogId && (
                  <Input
                    value={line.name}
                    onChange={(e) => updateLine(i, { name: e.target.value })}
                    placeholder="Nome do exame"
                    className="mt-2"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addManual}>
          <Plus className="h-4 w-4 mr-1" />
          Exame avulso (sem catálogo)
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
