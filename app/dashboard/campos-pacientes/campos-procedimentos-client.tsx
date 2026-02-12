"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
} from "@/app/dashboard/configuracoes/actions";
import {
  createProcedure,
  updateProcedure,
  deleteProcedure,
  type ProcedureRow,
} from "./actions";
import { CamposPacientesClient, type CustomFieldRow } from "./campos-pacientes-client";
import { Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type AppointmentTypeRow = {
  id: string;
  name: string;
  duration_minutes: number;
};

type Tab = "paciente" | "tipos" | "procedimentos";

export function CamposProcedimentosClient({
  initialFields,
  appointmentTypes,
  procedures,
}: {
  initialFields: CustomFieldRow[];
  appointmentTypes: AppointmentTypeRow[];
  procedures: ProcedureRow[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("paciente");

  const tabs: { id: Tab; label: string }[] = [
    { id: "paciente", label: "Campos de paciente" },
    { id: "tipos", label: "Tipos de consulta" },
    { id: "procedimentos", label: "Procedimentos" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Campos e procedimentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Campos de paciente, tipos de consulta (ex.: retorno, reagendada) e procedimentos (ex.: endoscopia) com recomendações e vínculo a formulários.
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
        {activeTab === "procedimentos" && (
          <ProcedimentosSection
            initialProcedures={procedures}
            onMutate={() => router.refresh()}
          />
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
            <h2 className="text-lg font-semibold">Tipos de consulta</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ex.: primeira vez, retorno, reagendada. A secretária escolhe ao agendar; formulários podem ser vinculados por tipo ou por procedimento.
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
                <Label htmlFor="duration">Duração (minutos) *</Label>
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
                {loading ? "Salvando…" : isNew ? "Criar tipo" : "Salvar alterações"}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(t)}
                  className="shrink-0"
                >
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

function ProcedimentosSection({
  initialProcedures,
  onMutate,
}: {
  initialProcedures: ProcedureRow[];
  onMutate: () => void;
}) {
  const [procedures, setProcedures] = useState<ProcedureRow[]>(initialProcedures);
  useEffect(() => {
    setProcedures(initialProcedures);
  }, [initialProcedures]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [recommendations, setRecommendations] = useState("");

  const showForm = isNew || editingId !== null;

  function openNew() {
    setEditingId(null);
    setIsNew(true);
    setName("");
    setRecommendations("");
    setError(null);
  }

  function openEdit(p: ProcedureRow) {
    setIsNew(false);
    setEditingId(p.id);
    setName(p.name);
    setRecommendations(p.recommendations || "");
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
      const res = await createProcedure(name, recommendations || null);
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
      const res = await updateProcedure(editingId, {
        name: name.trim(),
        recommendations: recommendations.trim() || null,
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setProcedures((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, name: name.trim(), recommendations: recommendations.trim() || null }
            : p
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
            <h2 className="text-lg font-semibold">Procedimentos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ex.: endoscopia, colonoscopia. Cada um tem recomendações padrão (usadas em e-mail e mensagens). Ao agendar, o procedimento pré-preenche as recomendações e pode auto-associar formulários vinculados a ele.
            </p>
          </div>
          {!showForm && (
            <Button variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo procedimento
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
            <div className="space-y-2">
              <Label htmlFor="proc_name">Nome *</Label>
              <Input
                id="proc_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Endoscopia"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proc_recommendations">Recomendações padrão</Label>
              <Textarea
                id="proc_recommendations"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Ex.: Jejum de 8h. Trazer exames anteriores..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Será usado em e-mails e mensagens; ao agendar com este procedimento, o campo de recomendações já virá preenchido.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : isNew ? "Criar procedimento" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        )}

        {procedures.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm mb-1">Nenhum procedimento cadastrado</p>
            <p className="text-xs">Adicione procedimentos para usar na agenda (ex.: endoscopia)</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {procedures.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-center justify-between py-3 first:pt-0",
                  editingId === p.id && "bg-muted/50 -mx-2 px-2 rounded"
                )}
              >
                <div>
                  <strong>{p.name}</strong>
                  {p.recommendations && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {p.recommendations}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(p)}
                  className="shrink-0"
                >
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
