import { listAtestadoInstances } from "../actions";
import { DocumentosListClient } from "../documentos-list-client";

export default async function AtestadosPage() {
  const { data, error } = await listAtestadoInstances();

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <DocumentosListClient
        title="Atestados"
        subtitle="Atestados preenchidos via ficha de atendimento."
        items={(data ?? []).map((d) => ({
          id: d.id,
          created_at: d.created_at,
          patient_name: d.patient_name,
          patient_id: d.patient_id,
          preview: d.preview,
          appointment_id: d.appointment_id,
        }))}
        emptyMessage="Nenhum atestado registrado ainda."
      />
    </>
  );
}
