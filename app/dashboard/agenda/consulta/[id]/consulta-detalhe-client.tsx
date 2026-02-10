"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateAppointment, deleteAppointment } from "../../actions";
import { Copy, Check, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { FormFieldDefinition } from "@/lib/form-types";
import { getStatusBackgroundColor, getStatusTextColor } from "../../agenda-client";
import { cn } from "@/lib/utils";

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

export function ConsultaDetalheClient({
  appointmentId,
  appointmentStatus,
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
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [showExcluirConfirm, setShowExcluirConfirm] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : baseUrl || "";
  const linkBase = origin ? `${origin}/f/` : "/f/";

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    const res = await updateAppointment(appointmentId, { status: newStatus });
    if (!res.error) setStatus(newStatus);
    setUpdating(false);
  }

  async function handleExcluir() {
    setShowExcluirConfirm(true);
  }

  async function confirmExcluir() {
    setUpdating(true);
    const res = await deleteAppointment(appointmentId);
    setUpdating(false);
    if (!res.error) {
      setShowExcluirConfirm(false);
      router.push("/dashboard/agenda");
    }
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
            <h2 className="font-semibold">Alterar status</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {["agendada", "confirmada", "realizada", "falta", "cancelada"].map(
                (s) => {
                  const isActive = status === s;
                  const bgColor = getStatusBackgroundColor(s);
                  const textColor = getStatusTextColor(s);
                  return (
                    <Button
                      key={s}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusChange(s)}
                      disabled={updating}
                      className={cn(
                        isActive && bgColor,
                        isActive && textColor,
                        isActive && "font-semibold",
                        !isActive && "hover:opacity-80"
                      )}
                    >
                      {s === "agendada"
                        ? "Agendada"
                        : s === "confirmada"
                          ? "Confirmada"
                          : s === "realizada"
                            ? "Realizada"
                            : s === "falta"
                              ? "Falta"
                              : "Cancelada"}
                    </Button>
                  );
                }
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

      {canEdit && (
        <div className="pt-4 border-t border-border">
          <Button
            variant="outline"
            size="lg"
            onClick={handleExcluir}
            disabled={updating}
            className="w-full max-w-md mx-auto flex text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Excluir agendamento
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showExcluirConfirm}
        title="Excluir agendamento"
        message="Tem certeza que deseja excluir este agendamento?"
        confirmLabel="Excluir"
        variant="destructive"
        loading={updating}
        onConfirm={confirmExcluir}
        onCancel={() => setShowExcluirConfirm(false)}
      />
    </div>
  );
}
