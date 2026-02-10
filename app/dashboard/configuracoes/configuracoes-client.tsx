"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
} from "./actions";
import { Plus, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoUpload } from "./logo-upload";

export type AppointmentTypeRow = {
  id: string;
  name: string;
  duration_minutes: number;
};

export function ConfiguracoesClient({
  appointmentTypes,
  clinicLogoUrl,
  clinicLogoScale,
}: {
  appointmentTypes: AppointmentTypeRow[];
  clinicLogoUrl: string | null;
  clinicLogoScale: number;
}) {
  const [types, setTypes] = useState<AppointmentTypeRow[]>(appointmentTypes);
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
      setTypes((prev) => [
        ...prev,
        { id: "", name: name.trim(), duration_minutes: duration },
      ]);
      cancelForm();
      window.location.reload();
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Logo da Clínica</h2>
          <p className="text-sm text-muted-foreground">
            A logo da clínica aparecerá no topo dos formulários enviados aos pacientes.
          </p>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogoUrl={clinicLogoUrl}
            currentScale={clinicLogoScale}
            type="clinic"
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Tipos de consulta</h2>
            <Button variant="outline" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo tipo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Defina os tipos (ex.: consulta geral, retorno, procedimento). A
            secretária escolhe o tipo ao agendar; formulários podem ser
            vinculados a cada tipo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="flex flex-wrap items-end gap-4 p-4 rounded-lg border border-border bg-muted/30"
            >
              {error && (
                <p className="w-full text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {error}
                </p>
              )}
              <div className="space-y-2 min-w-[200px]">
                <Label htmlFor="type_name">Nome</Label>
                <Input
                  id="type_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Consulta geral"
                  required
                />
              </div>
              <div className="space-y-2 w-28">
                <Label htmlFor="duration">Duração (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  max={240}
                  value={duration}
                  onChange={(e) =>
                    setDuration(parseInt(e.target.value, 10) || 30)
                  }
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : isNew ? "Criar" : "Salvar"}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelForm}>
                <X className="h-4 w-4" />
              </Button>
            </form>
          )}

          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Nenhum tipo de consulta cadastrado. Adicione um para usar na
              agenda.
            </p>
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
    </div>
  );
}
