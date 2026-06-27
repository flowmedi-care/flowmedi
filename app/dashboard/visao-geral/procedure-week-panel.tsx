"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisaoGeralWeekProcedure } from "./actions";

export function ProcedureWeekPanel({
  procedures,
  selectedProcedureId,
  onSelectProcedure,
}: {
  procedures: VisaoGeralWeekProcedure[];
  selectedProcedureId: string | null;
  onSelectProcedure: (id: string | null) => void;
}) {
  const withAppointments = procedures.filter((p) => p.weekCount > 0);
  const displayList = withAppointments.length > 0 ? withAppointments : procedures;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <span className="text-base font-semibold">Procedimentos</span>
          <p className="text-sm text-muted-foreground">Consultas na semana selecionada</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" asChild>
          <Link href="/dashboard/servicos-valores/procedimentos">
            Gerenciar
            <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <button
          type="button"
          onClick={() => onSelectProcedure(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            selectedProcedureId === null
              ? "border-primary/40 bg-primary/5 font-medium"
              : "border-border hover:bg-muted/50"
          )}
        >
          <span>Todos</span>
          <Badge variant="secondary" className="tabular-nums">
            {procedures.reduce((s, p) => s + p.weekCount, 0)}
          </Badge>
        </button>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {displayList.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum procedimento cadastrado.
            </p>
          ) : (
            displayList.map((proc) => (
              <button
                key={proc.id}
                type="button"
                onClick={() =>
                  onSelectProcedure(selectedProcedureId === proc.id ? null : proc.id)
                }
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selectedProcedureId === proc.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-muted/50",
                  proc.weekCount === 0 && "opacity-60"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{proc.name}</p>
                  <p className="text-xs text-muted-foreground">{proc.duration_minutes} min</p>
                </div>
                <Badge
                  variant={proc.weekCount > 0 ? "default" : "secondary"}
                  className="shrink-0 tabular-nums"
                >
                  {proc.weekCount}
                </Badge>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
