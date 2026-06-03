"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPatientFichasSummary } from "@/app/dashboard/agenda/clinical-ficha-actions";
import type { AppointmentFichaSummary } from "@/lib/clinical-ficha-types";

const FICHA_TYPE_LABEL: Record<string, string> = {
  fields: "Ficha",
  prescription: "Receita",
  exam_request: "Pedido de exame",
  notes: "Notas",
};

export function ProntuarioFichasSection({ patientId }: { patientId: string }) {
  const [fichas, setFichas] = useState<AppointmentFichaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getPatientFichasSummary(patientId);
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

  const byAppointment = new Map<string, AppointmentFichaSummary[]>();
  for (const f of fichas) {
    const list = byAppointment.get(f.appointment_id) ?? [];
    list.push(f);
    byAppointment.set(f.appointment_id, list);
  }

  return (
    <ul className="divide-y">
      {[...byAppointment.entries()].map(([apptId, items]) => {
        const scheduled = items[0]?.scheduled_at;
        return (
          <li key={apptId} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <p className="font-medium text-sm">
                {scheduled
                  ? new Date(scheduled).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Consulta"}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/agenda/atendimento/${apptId}`}>Atendimento</Link>
              </Button>
            </div>
            <ul className="space-y-1.5">
              {items.map((f) => (
                <li
                  key={f.instance_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {f.ficha_name}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {FICHA_TYPE_LABEL[f.ficha_type] ?? f.ficha_type}
                    </span>
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Concluída
                  </Badge>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
