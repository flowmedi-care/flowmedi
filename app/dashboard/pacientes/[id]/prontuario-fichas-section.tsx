"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPatientFichasDetailForProntuario } from "@/app/dashboard/agenda/clinical-ficha-actions";
import type { AppointmentFichaDetail } from "@/lib/clinical-ficha-types";
import { FichaFieldsPanel } from "@/app/dashboard/agenda/atendimento/ficha-fields-panel";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FICHA_TYPE_LABEL: Record<string, string> = {
  fields: "Ficha",
  prescription: "Receita",
  exam_request: "Pedido de exame",
  notes: "Notas",
};

export function ProntuarioFichasSection({ patientId }: { patientId: string }) {
  const [fichas, setFichas] = useState<AppointmentFichaDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);
  const [expandedFichaId, setExpandedFichaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getPatientFichasDetailForProntuario(patientId);
      if (!cancelled) {
        setFichas(res.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando fichas…</p>;
  }

  if (fichas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma ficha de atendimento concluída ainda.
      </p>
    );
  }

  const byAppointment = new Map<string, AppointmentFichaDetail[]>();
  for (const f of fichas) {
    const list = byAppointment.get(f.appointment_id) ?? [];
    list.push(f);
    byAppointment.set(f.appointment_id, list);
  }

  return (
    <ul className="divide-y">
      {[...byAppointment.entries()].map(([apptId, items]) => {
        const scheduled = items[0]?.scheduled_at;
        const isExpanded = expandedApptId === apptId;
        return (
          <li key={apptId} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <button
                type="button"
                className="flex items-center gap-2 text-left font-medium text-sm hover:text-primary transition-colors"
                onClick={() => {
                  setExpandedApptId(isExpanded ? null : apptId);
                  setExpandedFichaId(null);
                }}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
                {scheduled
                  ? new Date(scheduled).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Consulta"}
              </button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/agenda/atendimento/${apptId}`}>Atendimento</Link>
              </Button>
            </div>
            {isExpanded && (
              <ul className="space-y-3 mt-2 pl-2 border-l-2 border-border/40 ml-1">
                {items.map((f) => {
                  const fichaExpanded = expandedFichaId === f.instance_id;
                  const canShowContent =
                    f.ficha_type === "fields" && f.definition.length > 0;
                  return (
                    <li key={f.instance_id}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 text-sm text-left py-1 hover:text-primary transition-colors"
                        onClick={() =>
                          setExpandedFichaId(fichaExpanded ? null : f.instance_id)
                        }
                        disabled={!canShowContent}
                      >
                        <span className={cn(!canShowContent && "text-muted-foreground")}>
                          {f.ficha_name}
                          <span className="text-muted-foreground ml-2 text-xs">
                            {FICHA_TYPE_LABEL[f.ficha_type] ?? f.ficha_type}
                          </span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {canShowContent && (
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                fichaExpanded && "rotate-180"
                              )}
                            />
                          )}
                          <Badge variant="outline" className="text-xs">
                            Concluída
                          </Badge>
                        </div>
                      </button>
                      {fichaExpanded && canShowContent && (
                        <div className="mt-2 rounded-lg border border-border/50 bg-muted/10 p-4">
                          <FichaFieldsPanel
                            instanceId={f.instance_id}
                            templateName={f.ficha_name}
                            definition={f.definition}
                            initialResponses={f.responses}
                            interactive={false}
                            consultationLabel={
                              scheduled
                                ? `Consulta de ${new Date(scheduled).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}`
                                : undefined
                            }
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!isExpanded && (
              <ul className="space-y-1.5 pl-6">
                {items.map((f) => (
                  <li
                    key={f.instance_id}
                    className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
                  >
                    <span>
                      {f.ficha_name}
                      <span className="ml-2 text-xs">
                        {FICHA_TYPE_LABEL[f.ficha_type] ?? f.ficha_type}
                      </span>
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      Concluída
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
