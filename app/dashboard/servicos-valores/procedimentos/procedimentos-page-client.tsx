"use client";

import { useRouter } from "next/navigation";
import { ProcedimentosSection } from "../procedimentos-section";
import type { ProcedureRow } from "@/app/dashboard/campos-pacientes/actions";
import type { ClinicalFichaTemplateRow } from "@/app/dashboard/campos-pacientes/clinical-fichas-actions";

export function ProcedimentosPageClient({
  procedures,
  doctors,
  doctorIdsByProcedureId,
  services,
  products,
  fichaTemplates,
}: {
  procedures: ProcedureRow[];
  doctors: { id: string; full_name: string }[];
  doctorIdsByProcedureId: Record<string, string[]>;
  services: {
    id: string;
    nome: string;
    recurrence_billing_mode: "per_session" | "treatment_plan" | null;
  }[];
  products: { id: string; name: string; unit: string }[];
  fichaTemplates: ClinicalFichaTemplateRow[];
}) {
  const router = useRouter();

  return (
    <ProcedimentosSection
      initialProcedures={procedures}
      doctors={doctors}
      doctorIdsByProcedureId={doctorIdsByProcedureId}
      services={services}
      products={products}
      fichaTemplates={fichaTemplates}
      onMutate={() => router.refresh()}
    />
  );
}
