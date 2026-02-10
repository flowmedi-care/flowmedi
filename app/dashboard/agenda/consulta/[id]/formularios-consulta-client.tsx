"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Select component não disponível, usando select HTML nativo
import {
  getFormTemplatesForAppointment,
  linkFormToAppointment,
  submitFormPresentially,
  unlinkFormFromAppointment,
} from "./formularios-consulta-actions";
import type { FormInstanceItem } from "./page";
import { Plus, Edit2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormularioPreenchimentoPresencial } from "./formulario-preenchimento-presencial";

export function FormulariosConsultaClient({
  appointmentId,
  formInstances,
  isDoctor,
  canEdit,
}: {
  appointmentId: string;
  formInstances: FormInstanceItem[];
  isDoctor: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [availableTemplates, setAvailableTemplates] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [unlinkingFormId, setUnlinkingFormId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableTemplates();
  }, [appointmentId]);

  async function loadAvailableTemplates() {
    const result = await getFormTemplatesForAppointment(appointmentId);
    if (result.error) {
      setError(result.error);
    } else {
      setAvailableTemplates(result.data || []);
    }
  }

  async function handleLinkForm() {
    if (!selectedTemplate) {
      setError("Selecione um formulário para vincular.");
      return;
    }

    setLinking(true);
    setError(null);
    const result = await linkFormToAppointment(appointmentId, selectedTemplate);
    if (result.error) {
      setError(result.error);
    } else {
      setSelectedTemplate("");
      router.refresh();
      await loadAvailableTemplates();
    }
    setLinking(false);
  }

  async function handleUnlinkForm(formInstanceId: string) {
    setUnlinkingFormId(formInstanceId);
  }

  async function confirmUnlink() {
    if (!unlinkingFormId) return;

    setLinking(true);
    setError(null);
    const result = await unlinkFormFromAppointment(unlinkingFormId);
    if (result.error) {
      setError(result.error);
    } else {
      setUnlinkingFormId(null);
      router.refresh();
      await loadAvailableTemplates();
    }
    setLinking(false);
  }

  function formatResponseValue(value: unknown, type: string): string {
    if (value == null || value === "") return "—";
    if (type === "multiple_choice" && Array.isArray(value)) {
      return value.join(", ");
    }
    if (type === "date" && typeof value === "string") {
      try {
        return new Date(value).toLocaleDateString("pt-BR");
      } catch {
        return value;
      }
    }
    return String(value);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Vincular novo formulário */}
      {(isDoctor || canEdit) && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Vincular formulário</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todos os formulários disponíveis já estão vinculados a esta consulta.
              </p>
            ) : (
              <>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione um formulário</option>
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleLinkForm}
                  disabled={linking || !selectedTemplate}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {linking ? "Vinculando..." : "Vincular formulário"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de formulários */}
      {formInstances.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum formulário vinculado a esta consulta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {formInstances.map((fi) => {
            const isRespondido = fi.status === "respondido";
            const isEditing = editingFormId === fi.id;

            if (isEditing && isDoctor) {
              return (
                <FormularioPreenchimentoPresencial
                  key={fi.id}
                  formInstanceId={fi.id}
                  templateName={fi.template_name}
                  definition={fi.definition}
                  initialResponses={fi.responses}
                  onCancel={() => setEditingFormId(null)}
                  onSuccess={() => {
                    setEditingFormId(null);
                    router.refresh();
                  }}
                />
              );
            }

            return (
              <Card key={fi.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{fi.template_name}</h3>
                    <Badge
                      variant={
                        isRespondido
                          ? "success"
                          : fi.status === "incompleto"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {fi.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {isDoctor && !isRespondido && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingFormId(fi.id)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Responder presencialmente
                      </Button>
                    )}
                    {(isDoctor || canEdit) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlinkForm(fi.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Desvincular
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 border-t border-border">
                  {fi.definition.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Sem campos definidos.
                    </p>
                  ) : (
                    fi.definition.map((field) => (
                      <div key={field.id}>
                        <p className="text-sm text-muted-foreground">{field.label}</p>
                        <p className="font-medium">
                          {formatResponseValue(fi.responses[field.id], field.type)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={unlinkingFormId !== null}
        title="Desvincular formulário"
        message="Tem certeza que deseja desvincular este formulário? Esta ação não pode ser desfeita."
        confirmLabel="Desvincular"
        variant="destructive"
        loading={linking}
        onConfirm={confirmUnlink}
        onCancel={() => setUnlinkingFormId(null)}
      />
    </div>
  );
}
