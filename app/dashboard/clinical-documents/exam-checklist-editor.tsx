"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listExamCatalog } from "./actions";
import type { ExamCatalogItem } from "@/lib/clinical-documents/types";
import { cn } from "@/lib/utils";

export function ExamChecklistEditor({
  selectedIds,
  examNotes,
  onSelectionChange,
  onNotesChange,
}: {
  selectedIds: string[];
  examNotes: string;
  onSelectionChange: (ids: string[]) => void;
  onNotesChange: (notes: string) => void;
}) {
  const [catalog, setCatalog] = useState<ExamCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listExamCatalog().then((r) => {
      if (!r.error) setCatalog(r.data);
      setLoading(false);
    });
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ExamCatalogItem[]>();
    for (const item of catalog) {
      const cat = item.category?.trim() || "Geral";
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [catalog]);

  const columns = useMemo(() => {
    const cols: [string, ExamCatalogItem[]][][] = [[], [], []];
    byCategory.forEach((entry, i) => {
      cols[i % 3].push(entry);
    });
    return cols;
  }, [byCategory]);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(Array.from(next));
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando catálogo de exames...</p>;
  }

  if (catalog.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
        Cadastre exames em <strong>Meu Perfil</strong> (ou peça ao admin da clínica) para montar o
        pedido com checklist, como no modelo impresso.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Selecione os exames</Label>
        <p className="text-xs text-muted-foreground mb-3">
          {selectedIds.length} selecionado(s) — o impresso mostrará todos com marcação nos escolhidos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border bg-gradient-to-b from-teal-50/80 to-white dark:from-teal-950/20">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="space-y-4 min-w-0">
              {col.map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 mb-2 pb-1 border-b border-teal-200/60">
                    {category}
                  </h4>
                  <ul className="space-y-1.5">
                    {items.map((item) => {
                      const checked = selectedSet.has(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggle(item.id)}
                            className={cn(
                              "flex items-start gap-2 w-full text-left text-xs py-1 px-1 rounded-md transition-colors",
                              checked
                                ? "bg-teal-100/80 dark:bg-teal-900/40"
                                : "hover:bg-muted/60"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                checked
                                  ? "border-teal-700 bg-teal-700"
                                  : "border-teal-400 bg-white dark:bg-background"
                              )}
                            >
                              {checked && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </span>
                            <span className={cn(checked && "font-medium text-teal-900 dark:text-teal-100")}>
                              {item.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="exam-notes">Observações gerais (opcional)</Label>
        <Textarea
          id="exam-notes"
          value={examNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          placeholder="Jejum, contraste, urgência..."
          className="mt-1"
        />
      </div>
    </div>
  );
}
