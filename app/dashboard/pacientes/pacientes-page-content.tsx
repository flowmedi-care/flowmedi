import { Suspense } from "react";
import { PacientesClient } from "./pacientes-client";
import {
  loadPacientesList,
  loadPacientesMeta,
  type PacientesShell,
} from "./load-pacientes-data";
import { TablePageSkeleton } from "@/components/dashboard-ui/loading/table-page-skeleton";
import type { Patient } from "./pacientes-client";

async function PacientesMetaSection({
  shell,
  patients,
}: {
  shell: PacientesShell;
  patients: Patient[];
}) {
  const { customFields, nonRegistered } = await loadPacientesMeta(shell.clinicId);

  return (
    <PacientesClient
      initialPatients={patients}
      customFields={customFields}
      nonRegistered={nonRegistered}
      userRole={shell.userRole}
    />
  );
}

async function PacientesListSection({ shell }: { shell: PacientesShell }) {
  const patients = await loadPacientesList(shell.clinicId);

  return (
    <Suspense fallback={<TablePageSkeleton rows={6} />}>
      <PacientesMetaSection shell={shell} patients={patients} />
    </Suspense>
  );
}

export function PacientesPageContent({ shell }: { shell: PacientesShell }) {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <PacientesListSection shell={shell} />
    </Suspense>
  );
}
