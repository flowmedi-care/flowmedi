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

export function FormularioEditor({
  templateId,
  initialName,
  initialDefinition,
  initialAppointmentTypeId,
  initialIsPublic,
  appointmentTypes,
}: {
  templateId: string | null;
  initialName: string;
  initialDefinition: FormFieldDefinition[];
  initialAppointmentTypeId: string | null;
  initialIsPublic?: boolean;
  appointmentTypes: AppointmentTypeOption[];
}) {
  const [name, setName] = useState(initialName);
  const [definition, setDefinition] = useState<FormFieldDefinition[]>(initialDefinition);
  const [appointmentTypeId, setAppointmentTypeId] = useState<string | null>(
    initialAppointmentTypeId
  );
  const [isPublic, setIsPublic] = useState(initialIsPublic ?? false);
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
        isPublic
      );
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      window.location.href = "/dashboard/formularios";
      return;
    }
    const res = await createFormTemplate(name, definition, appointmentTypeId, isPublic);
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
      <Link href="/dashboard/formularios">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </Link>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">
            {isEdit ? "Editar formulário" : "Novo formulário"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Defina o nome e os campos. Opcionalmente vincule a um tipo de
            consulta para que este formulário seja aplicado ao agendar.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="template_name">Nome do formulário</Label>
              <Input
                id="template_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Anamnese geral"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment_type">Tipo de consulta (opcional)</Label>
              <select
                id="appointment_type"
                className="h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
                value={appointmentTypeId ?? ""}
                onChange={(e) =>
                  setAppointmentTypeId(e.target.value || null)
                }
              >
                <option value="">Nenhum</option>
                {appointmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="is_public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="is_public" className="cursor-pointer">
                Permitir uso público (pode ser compartilhado sem agendamento)
              </Label>
            </div>
            {isPublic && (
              <p className="text-sm text-muted-foreground">
                Quando ativado, este formulário pode ser compartilhado publicamente (ex: Instagram) e também pode ser enviado para pacientes agendados.
              </p>
            )}
            <FormBuilder
              definition={definition}
              onChange={setDefinition}
              disabled={loading}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : isEdit ? "Salvar" : "Criar formulário"}
              </Button>
              <Link href="/dashboard/formularios">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
