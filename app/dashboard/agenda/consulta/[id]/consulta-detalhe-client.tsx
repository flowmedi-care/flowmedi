"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateAppointment, deleteAppointment } from "../../actions";
import { Copy, Check, Calendar, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { FormFieldDefinition } from "@/lib/form-types";

type FormInstance = {
  id: string;
  status: string;
  link_token: string | null;
  responses: Record<string, unknown>;
  template_name: string;
  definition: (FormFieldDefinition & { id: string })[];
};

function formatResponseValue(
  value: unknown,
  type: string
): string {
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

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export function ConsultaDetalheClient({
  appointmentId,
  appointmentStatus,
  appointmentScheduledAt,
  formInstances,
  baseUrl,
  canEdit,
}: {
  appointmentId: string;
  appointmentStatus: string;
  appointmentScheduledAt: string;
  formInstances: FormInstance[];
  baseUrl: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(appointmentStatus);
  const [updating, setUpdating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showReagendar, setShowReagendar] = useState(false);
  const [reagendarDate, setReagendarDate] = useState(() => toLocalDateInput(appointmentScheduledAt));
  const [reagendarTime, setReagendarTime] = useState(() => toLocalTimeInput(appointmentScheduledAt));
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : baseUrl || "";
  const linkBase = origin ? `${origin}/f/` : "/f/";

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    const res = await updateAppointment(appointmentId, { status: newStatus });
    if (!res.error) setStatus(newStatus);
    setUpdating(false);
  }

  async function handleReagendar(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    const localDate = new Date(`${reagendarDate}T${reagendarTime}:00`);
    const res = await updateAppointment(appointmentId, {
      scheduled_at: localDate.toISOString(),
    });
    setUpdating(false);
    if (!res.error) {
      setShowReagendar(false);
      router.refresh();
    }
  }

  async function handleExcluir() {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;
    setUpdating(true);
    const res = await deleteAppointment(appointmentId);
    setUpdating(false);
    if (!res.error) router.push("/dashboard/agenda");
  }

  function copyLink(token: string) {
    const url = `${linkBase}${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Ações</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReagendar(true)}
              disabled={updating}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Reagendar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExcluir}
              disabled={updating}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir agendamento
            </Button>
          </CardContent>
        </Card>
      )}

      {showReagendar && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-semibold">Reagendar</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReagendar} className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Nova data</Label>
                  <Input
                    type="date"
                    value={reagendarDate}
                    onChange={(e) => setReagendarDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Novo horário</Label>
                  <Input
                    type="time"
                    value={reagendarTime}
                    onChange={(e) => setReagendarTime(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={updating}>
                  {updating ? "Salvando…" : "Salvar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowReagendar(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Alterar status</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["agendada", "confirmada", "realizada", "falta", "cancelada"].map(
                (s) => (
                  <Button
                    key={s}
                    variant={status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(s)}
                    disabled={updating}
                  >
                    {s}
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold">Formulários</h2>
        {formInstances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum formulário vinculado a esta consulta.
          </p>
        ) : (
          <div className="space-y-2">
            {formInstances.map((fi) => {
              const isExpanded = expandedFormId === fi.id;
              return (
                <Card key={fi.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() =>
                      setExpandedFormId(isExpanded ? null : fi.id)
                    }
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{fi.template_name}</h3>
                        <Badge
                          variant={
                            fi.status === "respondido"
                              ? "success"
                              : fi.status === "incompleto"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {fi.status}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      {canEdit && fi.link_token && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(fi.link_token!);
                          }}
                        >
                          {copiedToken === fi.link_token ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </CardHeader>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-3 border-t border-border">
                      {fi.definition.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Sem campos definidos.
                        </p>
                      ) : (
                        fi.definition.map((field) => (
                          <div key={field.id}>
                            <p className="text-sm text-muted-foreground">
                              {field.label}
                            </p>
                            <p className="font-medium">
                              {formatResponseValue(
                                fi.responses[field.id],
                                field.type
                              )}
                            </p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
