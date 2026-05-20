"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteClinicalTemplate,
  listClinicalTemplatesForManage,
  saveClinicalTemplate,
} from "./actions";
import type { ClinicalDocumentTemplate, ClinicalDocumentType } from "@/lib/clinical-documents/types";

const TYPE_TABS: { id: ClinicalDocumentType; label: string }[] = [
  { id: "prescription", label: "Receitas" },
  { id: "exam_request", label: "Pedidos de exame" },
];

export function ClinicalTemplatesSection({
  scope,
  title,
  description,
}: {
  scope: "clinic" | "doctor";
  title: string;
  description: string;
}) {
  const [docType, setDocType] = useState<ClinicalDocumentType>("prescription");
  const [templates, setTemplates] = useState<ClinicalDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClinicalDocumentTemplate | "new" | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listClinicalTemplatesForManage(docType, scope);
    if (res.error) setError(res.error);
    else {
      setTemplates(res.data);
      setError(null);
    }
    setLoading(false);
  }, [docType, scope]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing("new");
    setName("");
    setBody(
      docType === "prescription"
        ? "Paciente: {{nome_paciente}}\nCPF: {{cpf_paciente}}\n\nPrescrevo:\n\n"
        : "Paciente: {{nome_paciente}}\nCPF: {{cpf_paciente}}\n\nSolicito os seguintes exames:\n\n"
    );
    setIsActive(true);
  }

  function openEdit(t: ClinicalDocumentTemplate) {
    setEditing(t);
    setName(t.name);
    setBody(t.body);
    setIsActive(t.is_active);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Informe o nome do template.");
      return;
    }
    setSaving(true);
    const res = await saveClinicalTemplate({
      id: editing !== "new" && editing ? editing.id : undefined,
      type: docType,
      scope,
      name,
      body,
      is_active: isActive,
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
    const res = await deleteClinicalTemplate(deleteId);
    setDeleteId(null);
    if (res.error) setError(res.error);
    else await load();
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-2 pt-2">
          {TYPE_TABS.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={docType === t.id ? "default" : "outline"}
              onClick={() => {
                setDocType(t.id);
                setEditing(null);
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {editing ? (
          <div className="space-y-3 border rounded-lg p-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Texto (placeholders permitidos)</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
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
              Novo template
            </Button>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
            ) : (
              <ul className="divide-y border rounded-lg">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-3 gap-2">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      {!t.is_active && (
                        <span className="text-xs text-muted-foreground">Inativo</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir template"
        message="Tem certeza? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Card>
  );
}
