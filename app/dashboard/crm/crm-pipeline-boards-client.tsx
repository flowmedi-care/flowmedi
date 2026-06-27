"use client";

import Link from "next/link";
import { AppointmentPipelineClient } from "./appointment-pipeline-client";
import type { AppointmentPipelineItem } from "./pipeline-actions";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export type CrmPipelineViewMode = "list" | "kanban";

export function CrmPipelineBoardsClient({
  appointmentItems,
}: {
  appointmentItems: AppointmentPipelineItem[];
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Captação e repescagem</p>
          <p className="text-sm text-muted-foreground">
            Leads, formulários e oportunidades de retorno estão no Centro de Leads.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/contatos/leads">
            Abrir Centro de Leads
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      <section id="comparecimento" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Comparecimento</h2>
          <p className="text-sm text-muted-foreground">
            Da consulta agendada até realização, falta ou cancelamento.
          </p>
        </div>
        <AppointmentPipelineClient initialItems={appointmentItems} />
      </section>
    </div>
  );
}
