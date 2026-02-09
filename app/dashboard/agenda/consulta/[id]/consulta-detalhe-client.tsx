"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateAppointment } from "../../actions";
import { Copy, Check } from "lucide-react";
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

export function ConsultaDetalheClient({
  appointmentId,
  appointmentStatus,
  formInstances,
  baseUrl,
  canEdit,
}: {
  appointmentId: string;
  appointmentStatus: string;
  formInstances: FormInstance[];
  baseUrl: string;
  canEdit: boolean;
}) {
  const [status, setStatus] = useState(appointmentStatus);
  const [updating, setUpdating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : baseUrl || "";
  const linkBase = origin ? `${origin}/f/` : "/f/";

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    const res = await updateAppointment(appointmentId, { status: newStatus });
    if (!res.error) setStatus(newStatus);
    setUpdating(false);
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
          formInstances.map((fi) => (
            <Card key={fi.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="font-medium">{fi.template_name}</h3>
                <div className="flex items-center gap-2">
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
                  {canEdit && fi.link_token && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(fi.link_token!)}
                    >
                      {copiedToken === fi.link_token ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {fi.definition.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
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
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
