import { listClinicalDocumentsByType } from "../actions";
import { DocumentosListClient } from "../documentos-list-client";

export default async function PrescricoesPage() {
  const { data, error } = await listClinicalDocumentsByType("prescription");

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <DocumentosListClient
        title="Prescrições"
        subtitle="Receitas médicas emitidas nos atendimentos."
        items={(data ?? []).map((d) => ({
          id: d.id,
          created_at: d.created_at,
          patient_name: d.patient_name,
          patient_id: d.patient_id,
          doctor_name: d.doctor_name,
          appointment_id: d.appointment_id ?? undefined,
          body_rendered: d.body_rendered,
        }))}
        emptyMessage="Nenhuma prescrição registrada ainda."
      />
    </>
  );
}
