"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AtendimentoListRow } from "./page";
import { Package, ExternalLink } from "lucide-react";

const STATUS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
};

export function AtendimentoListClient({ rows }: { rows: AtendimentoListRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma consulta no período para atendimento operacional.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.patient_name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(r.scheduled_at).toLocaleString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {r.doctor_name && ` · ${r.doctor_name}`}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge variant="outline">{STATUS[r.status] ?? r.status}</Badge>
                  {r.encounter_status && (
                    <Badge variant="secondary">Atend. {r.encounter_status}</Badge>
                  )}
                  {r.comanda_status && (
                    <Badge variant="secondary">Comanda {r.comanda_status}</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/agenda/consulta/${r.id}`}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Consulta
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/agenda/atendimento/${r.id}`}>
                    <Package className="h-4 w-4 mr-1" />
                    Atender
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
