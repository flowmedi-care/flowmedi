"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  getFormTemplatesForAppointment,
  linkFormToAppointment,
  type FormReportItem,
} from "../consulta/[id]/formularios-consulta-actions";
import { FormularioPreenchimentoPresencial } from "../consulta/[id]/formulario-preenchimento-presencial";
import type { FormFieldDefinition } from "@/lib/form-types";
import { Edit2, Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  respondido: "Respondido",
  incompleto: "Incompleto",
};

function statusVariant(status: string): "success" | "secondary" | "outline" {
  if (status === "respondido") return "success";
  if (status === "incompleto") return "secondary";
  return "outline";
}

function formatResponseValue(value: unknown, type: string): string {
  if (value == null || value === "") return "—";
  if (type === "multiple_choice" && Array.isArray(value)) return value.join(", ");
  if (type === "date" && typeof value === "string") {
    try {
      return new Date(value).toLocaleDateString("pt-BR");
    } catch {
      return value;
    }
  }
  return String(value);
}

export function AtendimentoRelatorioPanel({
  report,
  isDoctor,
  onUpdated,
}: {
  report: FormReportItem;
  isDoctor: boolean;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const isRespondido = report.status === "respondido";
  const canRespond = isDoctor && report.is_current_appointment;

  if (editing && canRespond) {
    return (
      <FormularioPreenchimentoPresencial
        formInstanceId={report.id}
        templateName={report.template_name}
        definition={report.definition as (FormFieldDefinition & { id: string })[]}
        initialResponses={report.responses}
        onCancel={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          onUpdated();
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{report.template_name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={statusVariant(report.status)}>
              {STATUS_LABEL[report.status] ?? report.status}
            </Badge>
            {!report.is_current_appointment && report.scheduled_at && (
              <span className="text-xs text-muted-foreground">
                Consulta de{" "}
                {new Date(report.scheduled_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {report.is_current_appointment && (
              <span className="text-xs text-muted-foreground">Esta consulta</span>
            )}
          </div>
        </div>
        {canRespond && !isRespondido && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="h-4 w-4 mr-1" />
            Responder presencialmente
          </Button>
        )}
        {canRespond && isRespondido && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="h-4 w-4 mr-1" />
            Editar respostas
          </Button>
        )}
      </div>

      {report.definition.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem campos definidos neste relatório.</p>
      ) : (
        <div className="space-y-4 rounded-lg border p-4 bg-muted/10">
          {report.definition.map((field) => (
            <div key={field.id}>
              <p className="text-sm text-muted-foreground">{field.label}</p>
              <p className="font-medium whitespace-pre-wrap">
                {formatResponseValue(report.responses[field.id], field.type)}
              </p>
            </div>
          ))}
        </div>
      )}

      {!report.is_current_appointment && (
        <p className="text-xs text-muted-foreground">
          Relatório de outra consulta — somente visualização.
        </p>
      )}
    </div>
  );
}

export function VincularRelatorioAtendimento({
  appointmentId,
  onLinked,
}: {
  appointmentId: string;
  onLinked: () => void;
}) {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await getFormTemplatesForAppointment(appointmentId);
    setTemplates(res.data ?? []);
    setLoaded(true);
    if (res.error) setError(res.error);
  }

  async function handleLink() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const res = await linkFormToAppointment(appointmentId, selected);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSelected("");
    onLinked();
    await load();
  }

  if (!loaded) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={load}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Vincular relatório…
      </Button>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-1">
        Todos os relatórios já estão vinculados.
      </p>
    );
  }

  return (
    <div className="px-2 py-2 space-y-2 border-t mt-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Label className="text-xs">Vincular relatório</Label>
      <select
        className="h-8 w-full rounded-md border px-2 text-xs bg-background"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Selecione…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        className="w-full h-8 text-xs"
        disabled={loading || !selected}
        onClick={handleLink}
      >
        {loading ? "Vinculando…" : "Vincular"}
      </Button>
    </div>
  );
}
