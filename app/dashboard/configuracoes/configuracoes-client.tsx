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
  updateComplianceConfirmationDays,
} from "./actions";
import { Plus, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoUpload } from "./logo-upload";
import { IntegrationsSection } from "./integrations-section";
import { TestEmailSection } from "./test-email-section";

export type AppointmentTypeRow = {
  id: string;
  name: string;
  duration_minutes: number;
};

export function ConfiguracoesClient({
  appointmentTypes,
  clinicLogoUrl,
  clinicLogoScale,
  complianceConfirmationDays,
  clinicId,
}: {
  appointmentTypes: AppointmentTypeRow[];
  clinicLogoUrl: string | null;
  clinicLogoScale: number;
  complianceConfirmationDays: number | null;
  clinicId: string;
}) {
  const [types, setTypes] = useState<AppointmentTypeRow[]>(appointmentTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [complianceDays, setComplianceDays] = useState<string>(
    complianceConfirmationDays !== null ? String(complianceConfirmationDays) : ""
  );
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

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
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as configurações gerais da clínica
        </p>
      </div>

      <IntegrationsSection clinicId={clinicId} />

      <TestEmailSection />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Logo da Clínica</h2>
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
            <div>
              <h2 className="text-lg font-semibold">Tipos de consulta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Defina os tipos (ex.: consulta geral, retorno, procedimento). A
                secretária escolhe o tipo ao agendar; formulários podem ser
                vinculados a cada tipo.
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Compliance de Confirmação</h2>
          <p className="text-sm text-muted-foreground">
            Defina quantos dias antes da consulta ela deve estar confirmada. 
            Consultas não confirmadas dentro do prazo aparecerão como alerta no dashboard da secretária.
            Exemplo: se definir 2 dias, uma consulta agendada para dia 17 deve estar confirmada até dia 15.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {complianceError && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {complianceError}
            </p>
          )}
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="compliance_days">Dias antes da consulta</Label>
              <Input
                id="compliance_days"
                type="number"
                min={0}
                max={30}
                value={complianceDays}
                onChange={(e) => setComplianceDays(e.target.value)}
                placeholder="Ex.: 2 (deixe vazio para desabilitar)"
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para desabilitar a regra de compliance
              </p>
            </div>
            <div className="pt-6">
              <Button
                onClick={async () => {
                  setComplianceError(null);
                  setComplianceLoading(true);
                  const daysValue = complianceDays.trim() === "" 
                    ? null 
                    : parseInt(complianceDays, 10);
                  
                  if (daysValue !== null && (isNaN(daysValue) || daysValue < 0 || daysValue > 30)) {
                    setComplianceError("O número de dias deve estar entre 0 e 30.");
                    setComplianceLoading(false);
                    return;
                  }

                  const res = await updateComplianceConfirmationDays(daysValue);
                  if (res.error) {
                    setComplianceError(res.error);
                  } else {
                    setComplianceError(null);
                  }
                  setComplianceLoading(false);
                }}
                disabled={complianceLoading}
              >
                {complianceLoading ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
          {complianceConfirmationDays !== null && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <strong>Configuração atual:</strong> Consultas devem estar confirmadas até{" "}
              <strong>{complianceConfirmationDays} dia{complianceConfirmationDays !== 1 ? "s" : ""}</strong> antes da data agendada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
