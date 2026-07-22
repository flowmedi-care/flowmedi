"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export type CrmPipelineViewMode = "list" | "kanban";

/**
 * KPI page no longer embeds comparecimento ops.
 * Kept as CTA strip for any legacy import.
 */
export function CrmPipelineBoardsClient(_props?: {
  appointmentItems?: unknown[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Operação de Cases e comparecimento</p>
          <p className="text-sm text-muted-foreground">
            Pendências, Fluxo e Comparecimento ficam na Jornada — este Pipeline é só KPI.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/pendencias">
            Abrir Pendências
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
