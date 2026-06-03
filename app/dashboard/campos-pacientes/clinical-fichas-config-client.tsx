"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormBuilder } from "@/app/dashboard/formularios/form-builder";
import {
  createClinicalFichaTemplate,
  updateClinicalFichaTemplate,
  type ClinicalFichaTemplateRow,
} from "./clinical-fichas-actions";
import type { ClinicalFichaType } from "@/lib/clinical-ficha-types";
import type { FormFieldDefinition } from "@/lib/form-types";
import { Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const FICHA_TYPE_LABEL: Record<ClinicalFichaType, string> = {
  fields: "Campos customizados",
  prescription: "Receita",
  exam_request: "Pedido de exame",
  notes: "Notas",
};

export function ClinicalFichasConfigClient({
  initialTemplates,
}: {
  initialTemplates: ClinicalFichaTemplateRow[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fichaType, setFichaType] = useState<ClinicalFichaType>("fields");
  const [definition, setDefinition] = useState<FormFieldDefinition[]>([]);
  const [displayOrder, setDisplayOrder] = useState("10");
  const [active, setActive] = useState(true);

  const showForm = isNew || editingId !== null;

  function openNew() {
    setIsNew(true);
    setEditingId(null);
    setName("");
    setFichaType("fields");
    setDefinition([]);
    setDisplayOrder(String((templates.length + 1) * 10));
    setActive(true);
    setError(null);
  }

  function openEdit(t: ClinicalFichaTemplateRow) {
    setIsNew(false);
    setEditingId(t.id);
    setName(t.name);
    setFichaType(t.ficha_type);
    setDefinition(t.definition);
    setDisplayOrder(String(t.display_order));
    setActive(t.active);
    setError(null);
  }

  function cancelForm() {
    setIsNew(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isNew) {
      const res = await createClinicalFichaTemplate({
        name: name.trim(),
        ficha_type: fichaType,
        definition: fichaType === "fields" ? definition : [],
        display_order: parseInt(displayOrder, 10) || 99,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      cancelForm();
      router.refresh();
      return;
    }

    if (editingId) {
      const res = await updateClinicalFichaTemplate(editingId, {
        name: name.trim(),
        definition: fichaType === "fields" ? definition : undefined,
        display_order: parseInt(displayOrder, 10) || 99,
        active,
      });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      cancelForm();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">Fichas de atendimento</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure as fichas exibidas na sidebar do atendimento clínico (anamnese, evolução, receita, etc.).
              Vincule-as aos procedimentos na aba Procedimentos.
            </p>
          </div>
          {!showForm && (
            <Button variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nova ficha
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-lg border border-border bg-muted/30 space-y-4"
          >
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ficha_name">Nome *</Label>
                <Input
                  id="ficha_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Anamnese"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ficha_order">Ordem</Label>
                <Input
                  id="ficha_order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>
            </div>
            {isNew && (
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={fichaType}
                  onChange={(e) => setFichaType(e.target.value as ClinicalFichaType)}
                >
                  <option value="fields">Campos customizados</option>
                  <option value="prescription">Receita</option>
                  <option value="exam_request">Pedido de exame</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Receita e pedido de exame usam o editor existente; não é possível alterar o tipo após criar.
                </p>
              </div>
            )}
            {!isNew && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Tipo:</Label>
                <Badge variant="outline">{FICHA_TYPE_LABEL[fichaType]}</Badge>
                {fichaType !== "fields" && (
                  <span className="text-xs text-muted-foreground">
                    (editor especial — sem campos customizados)
                  </span>
                )}
              </div>
            )}
            {!isNew && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Ficha ativa
              </label>
            )}
            {fichaType === "fields" && (
              <div className="space-y-2">
                <Label>Campos da ficha</Label>
                <FormBuilder definition={definition} onChange={setDefinition} />
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : isNew ? "Criar ficha" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm mb-1">Nenhuma ficha cadastrada</p>
            <p className="text-xs">
              Execute a migration clinical-fichas no Supabase ou crie uma ficha manualmente.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-center justify-between py-3 first:pt-0 gap-4",
                  editingId === t.id && "bg-muted/50 -mx-2 px-2 rounded"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong>{t.name}</strong>
                    <Badge variant="outline" className="text-xs">
                      {FICHA_TYPE_LABEL[t.ficha_type]}
                    </Badge>
                    {!t.active && (
                      <Badge variant="secondary" className="text-xs">
                        Inativa
                      </Badge>
                    )}
                    {t.is_system && (
                      <Badge variant="secondary" className="text-xs">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ordem: {t.display_order}
                    {t.ficha_type === "fields" && ` · ${t.definition.length} campo(s)`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
