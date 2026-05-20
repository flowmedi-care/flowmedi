"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteExamCatalogItem,
  deleteMedicationCatalogItem,
  listExamCatalogForManage,
  listMedicationCatalogForManage,
  saveExamCatalogItem,
  saveMedicationCatalogItem,
} from "./actions";
import type { ExamCatalogItem, MedicationCatalogItem } from "@/lib/clinical-documents/types";

type CatalogKind = "medication" | "exam";

export function ClinicalCatalogSection({
  kind,
  scope,
  title,
  description,
}: {
  kind: CatalogKind;
  scope: "clinic" | "doctor";
  title: string;
  description: string;
}) {
  const [items, setItems] = useState<(MedicationCatalogItem | ExamCatalogItem)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Geral");
  const [dosage, setDosage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [instructions, setInstructions] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res =
      kind === "medication"
        ? await listMedicationCatalogForManage(scope)
        : await listExamCatalogForManage(scope);
    if (res.error) setError(res.error);
    else {
      setItems(res.data);
      setError(null);
    }
    setLoading(false);
  }, [kind, scope]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing("new");
    setName("");
    setCategory("Geral");
    setDosage("");
    setQuantity("");
    setInstructions("");
  }

  function openEdit(item: MedicationCatalogItem | ExamCatalogItem) {
    setEditing(item.id);
    setName(item.name);
    if (kind === "exam") setCategory((item as ExamCatalogItem).category);
    if (kind === "medication") {
      const m = item as MedicationCatalogItem;
      setDosage(m.default_dosage);
      setQuantity(m.default_quantity);
      setInstructions(m.default_instructions);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    setSaving(true);
    const res =
      kind === "medication"
        ? await saveMedicationCatalogItem({
            id: editing !== "new" ? editing ?? undefined : undefined,
            scope,
            name,
            default_dosage: dosage,
            default_quantity: quantity,
            default_instructions: instructions,
          })
        : await saveExamCatalogItem({
            id: editing !== "new" ? editing ?? undefined : undefined,
            scope,
            name,
            category,
          });
    setSaving(false);
    if (res.error) setError(res.error);
    else {
      setEditing(null);
      await load();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res =
      kind === "medication"
        ? await deleteMedicationCatalogItem(deleteId)
        : await deleteExamCatalogItem(deleteId);
    setDeleteId(null);
    if (res.error) setError(res.error);
    else await load();
  }

  const groupedExams =
    kind === "exam"
      ? (items as ExamCatalogItem[]).reduce<Record<string, ExamCatalogItem[]>>((acc, e) => {
          const c = e.category || "Geral";
          acc[c] = acc[c] ?? [];
          acc[c].push(e);
          return acc;
        }, {})
      : null;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {editing ? (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <div>
              <Label>Nome {kind === "medication" ? "do medicamento" : "do exame"}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {kind === "exam" && (
              <div>
                <Label>Categoria (agrupa no pedido impresso)</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex.: Próstata, Urinário, Sorologias"
                />
              </div>
            )}
            {kind === "medication" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Dosagem padrão</Label>
                    <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500mg" />
                  </div>
                  <div>
                    <Label>Quantidade padrão</Label>
                    <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="30 comp." />
                  </div>
                </div>
                <div>
                  <Label>Posologia padrão</Label>
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={2}
                    placeholder="1 comprimido ao dia..."
                  />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Cadastrar {kind === "medication" ? "medicamento" : "exame"}
            </Button>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum item no catálogo. Cadastre para usar na emissão rápida.
              </p>
            ) : kind === "medication" ? (
              <ul className="divide-y border rounded-lg text-sm">
                {(items as MedicationCatalogItem[]).map((m) => (
                  <li key={m.id} className="flex justify-between items-center p-3 gap-2">
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[m.default_dosage, m.default_quantity].filter(Boolean).join(" • ")}
                        {m.default_instructions ? ` — ${m.default_instructions}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-4">
                {groupedExams &&
                  Object.entries(groupedExams)
                    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
                    .map(([cat, exams]) => (
                      <div key={cat}>
                        <p className="text-xs font-semibold uppercase text-primary mb-1">{cat}</p>
                        <ul className="divide-y border rounded-lg text-sm">
                          {exams.map((e) => (
                            <li key={e.id} className="flex justify-between items-center p-2 gap-2">
                              <span>{e.name}</span>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteId(e.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir item"
        message="Remover este item do catálogo?"
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}
