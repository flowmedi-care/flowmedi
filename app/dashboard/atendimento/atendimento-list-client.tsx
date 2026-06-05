"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AtendimentoListRow } from "./page";
import { Play, ExternalLink } from "lucide-react";

const STATUS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
};

const ENCOUNTER_BADGE: Record<string, { label: string; className?: string }> = {
  em_andamento: { label: "Em atendimento" },
  finalizado_aguardando_cobranca: {
    label: "Aguardando cupom",
    className: "border-amber-300 text-amber-800 dark:text-amber-300",
  },
  cobrado: { label: "Quitado", className: "border-green-300 text-green-800 dark:text-green-300" },
};

const COMANDA_BADGE: Record<string, string> = {
  aberta: "Cupom aberto",
  parcial: "Cupom parcial",
  paga: "Quitado",
};

function resolveOperationalBadge(row: AtendimentoListRow) {
  if (row.comanda_status === "paga" || row.encounter_status === "cobrado") {
    return { label: "Quitada", className: "border-green-300 text-green-800 dark:text-green-300" };
  }
  if (row.comanda_status === "aberta" || row.comanda_status === "parcial") {
    return { label: COMANDA_BADGE[row.comanda_status] ?? row.comanda_status };
  }
  if (row.encounter_status === "finalizado_aguardando_cobranca") {
    return ENCOUNTER_BADGE.finalizado_aguardando_cobranca;
  }
  if (row.encounter_status) {
    return ENCOUNTER_BADGE[row.encounter_status] ?? { label: row.encounter_status };
  }
  return null;
}

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
          {rows.map((r) => {
            const opBadge = resolveOperationalBadge(r);
            return (
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
                    {opBadge && (
                      <Badge variant="outline" className={opBadge.className}>
                        {opBadge.label}
                      </Badge>
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
                  <Link href={`/dashboard/agenda/consulta/${r.id}?autostart=1`}>
                    <Play className="h-4 w-4 mr-1" />
                    Iniciar atendimento
                  </Link>
                </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
