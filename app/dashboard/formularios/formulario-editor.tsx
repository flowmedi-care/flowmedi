"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormBuilder } from "./form-builder";
import { createFormTemplate, updateFormTemplate } from "./actions";
import type { FormFieldDefinition } from "@/lib/form-types";
import { ArrowLeft } from "lucide-react";

type AppointmentTypeOption = { id: string; name: string };

type DoctorOption = { id: string; full_name: string | null };

type ProcedureOption = { id: string; name: string };

export function FormularioEditor({
  templateId,
  initialName,
  initialDefinition,
  initialAppointmentTypeId,
  initialProcedureIds,
  initialIsPublic,
  initialPublicDoctorId,
  appointmentTypes,
  procedures,
  doctors,
}: {
  templateId: string | null;
  initialName: string;
  initialDefinition: FormFieldDefinition[];
  initialAppointmentTypeId: string | null;
  initialProcedureIds: string[];
  initialIsPublic?: boolean;
  initialPublicDoctorId?: string | null;
  appointmentTypes: AppointmentTypeOption[];
  procedures: ProcedureOption[];
  doctors: DoctorOption[];
}) {
  const [name, setName] = useState(initialName);
  const [definition, setDefinition] = useState<FormFieldDefinition[]>(initialDefinition);
  const [appointmentTypeId, setAppointmentTypeId] = useState<string | null>(
    initialAppointmentTypeId
  );
  const [procedureIds, setProcedureIds] = useState<string[]>(initialProcedureIds);
  const [isPublic, setIsPublic] = useState(initialIsPublic ?? false);
  const [publicDoctorId, setPublicDoctorId] = useState<string | null>(initialPublicDoctorId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!templateId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (isEdit && templateId) {
      const res = await updateFormTemplate(
        templateId,
        name,
        definition,
        appointmentTypeId,
        isPublic,
        publicDoctorId,
        procedureIds
      );
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      window.location.href = "/dashboard/formularios";
      return;
    }
    const res = await createFormTemplate(name, definition, appointmentTypeId, isPublic, publicDoctorId, procedureIds);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard/formularios";
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {isEdit ? "Editar formulário" : "Novo formulário"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit 
              ? "Atualize as informações e campos do formulário"
              : "Crie um novo formulário para coletar informações dos pacientes"
            }
          </p>
        </div>
        <Link href="/dashboard/formularios">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* Seção: Informações Básicas */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Informações básicas</h2>
            <p className="text-sm text-muted-foreground">
              Defina o nome e a vinculação do formulário
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template_name">
                Nome do formulário <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Anamnese geral"
                required
                className="max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment_type">Tipo de consulta</Label>
              <select
                id="appointment_type"
                className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
                value={appointmentTypeId ?? ""}
                onChange={(e) =>
                  setAppointmentTypeId(e.target.value || null)
                }
              >
                <option value="">Nenhum (formulário genérico)</option>
                {appointmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Se vinculado a um tipo de consulta, este formulário pode ser aplicado ao agendar
              </p>
            </div>
            <div className="space-y-2">
              <Label>Procedimentos</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione os procedimentos que usam este formulário. Ao agendar com um desses procedimentos, o formulário será associado automaticamente.
              </p>
              <div className="flex flex-wrap gap-2">
                {procedures.map((proc) => {
                  const checked = procedureIds.includes(proc.id);
                  return (
                    <label
                      key={proc.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setProcedureIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== proc.id)
                              : [...prev, proc.id]
                          );
                        }}
                        className="h-4 w-4 rounded border-input"
                      />
                      {proc.name}
                    </label>
                  );
                })}
                {procedures.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum procedimento cadastrado. Crie em Campos e procedimentos.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção: Configurações Públicas */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Uso público</h2>
            <p className="text-sm text-muted-foreground">
              Configure se este formulário pode ser compartilhado publicamente
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="is_public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-input"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="is_public" className="cursor-pointer font-medium">
                  Permitir uso público
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, este formulário pode ser compartilhado publicamente (ex: Instagram) 
                  e também pode ser enviado para pacientes agendados.
                </p>
              </div>
            </div>
            
            {isPublic && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="public_doctor">Médico associado</Label>
                  <select
                    id="public_doctor"
                    className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
                    value={publicDoctorId ?? ""}
                    onChange={(e) => setPublicDoctorId(e.target.value || null)}
                  >
                    <option value="">Nenhum</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name || d.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    A assinatura do médico aparecerá no final do formulário público
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção: Campos do Formulário */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Campos do formulário</h2>
            <p className="text-sm text-muted-foreground">
              Adicione e configure os campos que serão exibidos no formulário
            </p>
          </CardHeader>
          <CardContent>
            <FormBuilder
              definition={definition}
              onChange={setDefinition}
              disabled={loading}
            />
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Link href="/dashboard/formularios">
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar formulário"}
          </Button>
        </div>
      </form>
    </div>
  );
}
