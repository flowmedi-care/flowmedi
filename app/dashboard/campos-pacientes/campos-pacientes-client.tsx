"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomFieldInsert,
} from "./actions";
import { Plus, Pencil, Trash2, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type CustomFieldRow = {
  id: string;
  field_name: string;
  field_type: "text" | "number" | "date" | "textarea" | "select";
  field_label: string;
  required: boolean;
  options: string[] | null;
  display_order: number;
  include_in_public_form?: boolean;
};

export function CamposPacientesClient({
  initialFields,
}: {
  initialFields: CustomFieldRow[];
}) {
  const [fields, setFields] = useState<CustomFieldRow[]>(initialFields);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldRow | null>(null);
  const [form, setForm] = useState<CustomFieldInsert & { id?: string }>({
    field_name: "",
    field_type: "text",
    field_label: "",
    required: false,
    options: [],
    display_order: fields.length,
    include_in_public_form: false,
  });
  const [optionsText, setOptionsText] = useState("");

  const showForm = isNew || editingId !== null;

  function openNew() {
    setEditingId(null);
    setIsNew(true);
    setForm({
      field_name: "",
      field_type: "text",
      field_label: "",
      required: false,
      options: [],
      display_order: fields.length,
      include_in_public_form: false,
    });
    setOptionsText("");
    setError(null);
  }

  function openEdit(f: CustomFieldRow) {
    setIsNew(false);
    setEditingId(f.id);
    setForm({
      id: f.id,
      field_name: f.field_name,
      field_type: f.field_type,
      field_label: f.field_label,
      required: f.required,
      options: f.options || [],
      display_order: f.display_order,
      include_in_public_form: f.include_in_public_form ?? false,
    });
    setOptionsText((f.options || []).join(", "));
    setError(null);
  }

  function cancelForm() {
    setEditingId(null);
    setIsNew(false);
    setError(null);
  }

  function openDeleteConfirm(f: CustomFieldRow) {
    setFieldToDelete(f);
  }

  async function handleConfirmDelete() {
    if (!fieldToDelete) return;
    setDeletingId(fieldToDelete.id);
    const res = await deleteCustomField(fieldToDelete.id);
    setDeletingId(null);
    if (!res.error) {
      setFieldToDelete(null);
      setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
    } else {
      setError(res.error);
      setFieldToDelete(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fieldName = form.field_name.trim().toLowerCase().replace(/\s+/g, "_");
    const options = form.field_type === "select" && optionsText.trim()
      ? optionsText.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

    if (form.field_type === "select" && options.length === 0) {
      setError("Campos do tipo 'Seleção' precisam ter pelo menos uma opção.");
      setLoading(false);
      return;
    }

    const data: CustomFieldInsert = {
      field_name: fieldName,
      field_type: form.field_type,
      field_label: form.field_label.trim(),
      required: form.required,
      options: form.field_type === "select" ? options : undefined,
      display_order: form.display_order,
      include_in_public_form: form.include_in_public_form ?? false,
    };

    if (isNew) {
      const res = await createCustomField(data);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setFields((prev) => [
        ...prev,
        {
          id: "",
          ...data,
          options: data.options || null,
        },
      ]);
      cancelForm();
      window.location.reload();
      return;
    }

    if (editingId) {
      const res = await updateCustomField(editingId, data);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingId
            ? {
                ...f,
                ...data,
                options: data.options || null,
              }
            : f
        )
      );
      cancelForm();
    }
    setLoading(false);
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Campos de paciente</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Personalize os campos de cadastro. Nome, email, telefone, data de nascimento e observações são sempre exibidos.
            </p>
          </div>
          {!showForm && (
            <Button variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo campo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-lg border border-border bg-muted/30 space-y-5"
          >
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {error}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="field_label">Rótulo do campo *</Label>
                  <Input
                    id="field_label"
                    value={form.field_label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, field_label: e.target.value }))
                    }
                    placeholder="Ex.: CPF, Endereço, Plano de saúde"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field_type">Tipo *</Label>
                  <select
                    id="field_type"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.field_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, field_type: e.target.value as CustomFieldInsert["field_type"] }))
                    }
                    required
                  >
                    <option value="text">Texto curto</option>
                    <option value="textarea">Texto longo</option>
                    <option value="number">Número</option>
                    <option value="date">Data</option>
                    <option value="select">Seleção</option>
                  </select>
                </div>
              </div>
              {form.field_type === "select" && (
                <div className="space-y-2">
                  <Label htmlFor="options">Opções (separadas por vírgula) *</Label>
                  <Input
                    id="options"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="Ex.: Opção 1, Opção 2, Opção 3"
                    required
                  />
                </div>
              )}
              
              <div className="pt-2 space-y-3 border-t border-border">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="required"
                    checked={form.required}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, required: e.target.checked }))
                    }
                    className="h-4 w-4 mt-0.5 rounded border-input"
                  />
                  <div className="flex-1">
                    <Label htmlFor="required" className="cursor-pointer font-medium">
                      Campo obrigatório
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O paciente precisará preencher este campo ao se cadastrar
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="include_in_public_form"
                    checked={form.include_in_public_form ?? false}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, include_in_public_form: e.target.checked }))
                    }
                    className="h-4 w-4 mt-0.5 rounded border-input"
                  />
                  <div className="flex-1">
                    <Label htmlFor="include_in_public_form" className="cursor-pointer font-medium">
                      Incluir em formulários públicos
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Este campo aparecerá nos formulários públicos antes dos campos do template
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={cancelForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando…" : isNew ? "Criar campo" : "Salvar alterações"}
                </Button>
              </div>
            </form>
        )}

        {fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm mb-1">Nenhum campo customizado cadastrado</p>
              <p className="text-xs">Adicione campos para personalizar o cadastro de pacientes</p>
            </div>
        ) : (
          <ul className="divide-y divide-border">
            {fields.map((f) => (
              <li
                key={f.id}
                className={cn(
                  "flex items-center justify-between py-3 first:pt-0",
                  editingId === f.id && "bg-muted/50 -mx-2 px-2 rounded"
                )}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <strong>{f.field_label}</strong>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({f.field_type})
                      {f.required && " • Obrigatório"}
                    </span>
                    {f.options && f.options.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Opções: {f.options.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(f)}
                    className="shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteConfirm(f)}
                    disabled={deletingId === f.id}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>

      <ConfirmDialog
        open={!!fieldToDelete}
        title="Excluir campo"
        message={`Tem certeza que deseja excluir o campo "${fieldToDelete?.field_label}"? Os valores já cadastrados serão mantidos, mas o campo não aparecerá mais em novos cadastros.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFieldToDelete(null)}
      />
  </>
  );
}
