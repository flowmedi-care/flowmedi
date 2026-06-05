"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
} from "@/app/dashboard/configuracoes/actions";
import { CamposPacientesClient, type CustomFieldRow } from "./campos-pacientes-client";
import { ClinicalFichasConfigClient } from "./clinical-fichas-config-client";
import type { ClinicalFichaTemplateRow } from "./clinical-fichas-actions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormulariosListClient } from "@/app/dashboard/formularios/formularios-list-client";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type AppointmentTypeRow = {
  id: string;
  name: string;
  duration_minutes: number;
};

type Tab = "paciente" | "tipos" | "fichas" | "formularios";

type FormTemplateRow = {
  id: string;
  name: string;
  appointment_type_name: string | null;
  is_public: boolean;
};

export function CamposProcedimentosClient({
  initialFields,
  appointmentTypes,
  fichaTemplates,
  formTemplates,
  formPatients,
  initialTab,
}: {
  initialFields: CustomFieldRow[];
  appointmentTypes: AppointmentTypeRow[];
  fichaTemplates: ClinicalFichaTemplateRow[];
  formTemplates?: FormTemplateRow[];
  formPatients?: { id: string; full_name: string }[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "paciente");

  const tabs: { id: Tab; label: string }[] = [
    { id: "paciente", label: "Campos de paciente" },
    { id: "tipos", label: "Tipos de atendimento" },
    { id: "fichas", label: "Fichas de atendimento" },
    { id: "formularios", label: "FormulÃ¡rios" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Campos personalizados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Campos do paciente, tipos de atendimento, fichas e formulÃ¡rios da clÃ­nica.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === "paciente" && (
          <CamposPacientesClient initialFields={initialFields} />
        )}
        {activeTab === "tipos" && (
          <TiposConsultaSection
            initialTypes={appointmentTypes}
            onMutate={() => router.refresh()}
          />
        )}
        {activeTab === "fichas" && (
          <ClinicalFichasConfigClient initialTemplates={fichaTemplates} />
        )}
        {activeTab === "formularios" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                FormulÃ¡rios de prÃ©-consulta e captaÃ§Ã£o vinculados aos atendimentos.
              </p>
              <Link href="/dashboard/formularios/novo">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo formulÃ¡rio
                </Button>
              </Link>
            </div>
            {formTemplates && formPatients ? (
              <FormulariosListClient
                templates={formTemplates}
                patients={formPatients}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Carregando formulÃ¡riosâ€¦</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TiposConsultaSection({
  initialTypes,
  onMutate,
}: {
  initialTypes: AppointmentTypeRow[];
  onMutate: () => void;
}) {
  const [types, setTypes] = useState<AppointmentTypeRow[]>(initialTypes);
  useEffect(() => {
    setTypes(initialTypes);
  }, [initialTypes]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<AppointmentTypeRow | null>(null);

  const showForm = isNew || editingId !== null;

  function openNew() {
    setEditingId(null);
    setIsNew(true);
    setName("");
    setDuration(30);
    setError(null);
  }

  function openEdit(t: AppointmentTypeRow) {
    setIsNew(false);
    setEditingId(t.id);
    setName(t.name);
    setDuration(t.duration_minutes);
    setError(null);
  }

  function cancelForm() {
    setEditingId(null);
    setIsNew(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (isNew) {
      const res = await createAppointmentType(name, duration);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      cancelForm();
      onMutate();
      setLoading(false);
      return;
    }
    if (editingId) {
      const res = await updateAppointmentType(editingId, {
        name: name.trim(),
        duration_minutes: duration,
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setTypes((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, name: name.trim(), duration_minutes: duration }
            : t
        )
      );
      cancelForm();
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Tipos de atendimento</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ex.: primeira vez, retorno, reagendada. O SecretÃ¡rio(a) escolhe ao agendar; formulÃ¡rios podem ser vinculados por tipo ou por procedimento.
            </p>
          </div>
          {!showForm && (
            <Button variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo tipo
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
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type_name">Nome *</Label>
                <Input
                  id="type_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Consulta geral"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">DuraÃ§Ã£o (minutos) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  max={240}
                  value={duration}
                  onChange={(e) =>
                    setDuration(parseInt(e.target.value, 10) || 30)
                  }
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvandoâ€¦" : isNew ? "Criar tipo" : "Salvar alteraÃ§Ãµes"}
              </Button>
            </div>
          </form>
        )}

        {types.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm mb-1">Nenhum tipo de consulta cadastrado</p>
            <p className="text-xs">Adicione um tipo para usar na agenda</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {types.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-center justify-between py-2 first:pt-0",
                  editingId === t.id && "bg-muted/50 -mx-2 px-2 rounded"
                )}
              >
                <span>
                  <strong>{t.name}</strong>
                  <span className="text-muted-foreground text-sm ml-2">
                    {t.duration_minutes} min
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(t)}
                    className="shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTypeToDelete(t)}
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === t.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!typeToDelete}
        title="Excluir tipo de atendimento"
        message={`Tem certeza que deseja excluir "${typeToDelete?.name ?? ""}"?`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={deletingId !== null}
        onCancel={() => setTypeToDelete(null)}
        onConfirm={async () => {
          if (!typeToDelete) return;
          setDeletingId(typeToDelete.id);
          const res = await deleteAppointmentType(typeToDelete.id);
          setDeletingId(null);
          if (res.error) {
            setError(res.error);
            return;
          }
          setTypeToDelete(null);
          onMutate();
        }}
      />
    </Card>
  );
}
