"use client";

import { useState } from "react";
import { PipelineClient } from "../pipeline/pipeline-client";
import { AppointmentPipelineClient } from "./appointment-pipeline-client";
import type { PipelineItem } from "../pipeline/actions";
import type { AppointmentPipelineItem } from "./pipeline-actions";

export type CrmPipelineViewMode = "list" | "kanban";

export function CrmPipelineBoardsClient({
  pipelineItems,
  appointmentItems,
}: {
  pipelineItems: PipelineItem[];
  appointmentItems: AppointmentPipelineItem[];
}) {
  const [viewMode, setViewMode] = useState<CrmPipelineViewMode>("kanban");

  return (
    <>
      <section id="captacao" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Captação</h2>
          <p className="text-sm text-muted-foreground">
            Do primeiro contato até o agendamento.
          </p>
        </div>
        <PipelineClient
          initialItems={pipelineItems}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </section>

      <section id="comparecimento" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Comparecimento</h2>
          <p className="text-sm text-muted-foreground">
            Da consulta agendada até realização, falta ou cancelamento.
          </p>
        </div>
        <AppointmentPipelineClient
          initialItems={appointmentItems}
          viewMode={viewMode}
        />
      </section>
    </>
  );
}
