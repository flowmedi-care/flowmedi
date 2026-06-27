"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AtendimentoListRow } from "./page";
import { Play, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayHeader, groupRowsByDay, isToday } from "@/lib/operational-queue";

const STATUS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
};

const ENCOUNTER_BADGE: Record<string, { label: string; className?: string }> = {
  em_andamento: { label: "Em atendimento" },
  finalizado_aguardando_cobranca: {
    label: "Aguardando comanda",
    className: "border-amber-300 text-amber-800 dark:text-amber-300",
  },
  cobrado: { label: "Quitado", className: "border-green-300 text-green-800 dark:text-green-300" },
};

const COMANDA_BADGE: Record<string, string> = {
  aberta: "Comanda aberta",
  parcial: "Comanda parcial",
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

function AppointmentRow({ r }: { r: AtendimentoListRow }) {
  const opBadge = resolveOperationalBadge(r);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
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
}

export function AtendimentoListClient({ rows }: { rows: AtendimentoListRow[] }) {
  const dayGroups = useMemo(() => groupRowsByDay(rows), [rows]);

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
    <div className="space-y-4">
      {dayGroups.map(({ dayKey, rows: dayRows }) => {
        const today = isToday(dayKey);
        return (
          <Card
            key={dayKey}
            className={cn(
              today && "border-primary/40 bg-primary/[0.03] shadow-sm ring-1 ring-primary/20"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-2 border-b px-4 py-2.5",
                today && "bg-primary/10 border-primary/20"
              )}
            >
              <h2 className="text-sm font-semibold capitalize">{formatDayHeader(dayKey)}</h2>
              <div className="flex items-center gap-2">
                {today && (
                  <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                    Hoje
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {dayRows.length} consulta{dayRows.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <CardContent className="p-0">
              <ul className="divide-y">
                {dayRows.map((r) => (
                  <AppointmentRow key={r.id} r={r} />
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
