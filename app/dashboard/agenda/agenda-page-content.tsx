import { Suspense } from "react";
import { AgendaClient } from "./agenda-client";
import { SchemaErrorBanner } from "./schema-error-banner";
import {
  loadAgendaCatalog,
  loadAgendaAppointments,
  type AgendaShell,
} from "./load-agenda-data";
import { CalendarPageSkeleton } from "@/components/dashboard-ui/loading/calendar-page-skeleton";
import type { ScheduleBlockRow } from "@/lib/schedule-blocks";

async function AgendaAppointmentsSection({
  shell,
  catalog,
}: {
  shell: AgendaShell;
  catalog: Awaited<ReturnType<typeof loadAgendaCatalog>>;
}) {
  const { rows, appointmentsError } = await loadAgendaAppointments(shell, catalog);

  return (
    <div className="space-y-4">
      {appointmentsError && <SchemaErrorBanner message={appointmentsError.message} />}
      <AgendaClient
        appointments={rows}
        agendaStartHour={shell.agendaStartHour}
        agendaEndHour={shell.agendaEndHour}
        patients={catalog.patients}
        doctors={catalog.doctors}
        rooms={catalog.rooms}
        roomsRequired={catalog.roomsRequired}
        procedures={catalog.procedures}
        formTemplates={catalog.formTemplates}
        services={catalog.services}
        pricingDimensions={catalog.pricingDimensions}
        pricingDimensionValues={catalog.pricingDimensionValues}
        servicePriceRules={catalog.servicePriceRules}
        doctorProcedures={catalog.doctorProcedures}
        scheduleBlocks={catalog.scheduleBlocks as ScheduleBlockRow[]}
        userRole={shell.role}
        initialPreferences={shell.initialPreferences}
      />
    </div>
  );
}

async function AgendaCatalogSection({ shell }: { shell: AgendaShell }) {
  const catalog = await loadAgendaCatalog(shell);

  return (
    <Suspense fallback={<CalendarPageSkeleton />}>
      <AgendaAppointmentsSection shell={shell} catalog={catalog} />
    </Suspense>
  );
}

export function AgendaPageContent({ shell }: { shell: AgendaShell }) {
  return (
    <Suspense fallback={<CalendarPageSkeleton />}>
      <AgendaCatalogSection shell={shell} />
    </Suspense>
  );
}
