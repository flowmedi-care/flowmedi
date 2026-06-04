import { listClinicalDocumentsByType } from "../actions";
import { DocumentosListClient } from "../documentos-list-client";

export default async function PedidosExamePage() {
  const { data, error } = await listClinicalDocumentsByType("exam_request");

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <DocumentosListClient
        title="Pedidos de exame"
        subtitle="Solicitações de exames emitidas nos atendimentos."
        items={(data ?? []).map((d) => ({
          id: d.id,
          created_at: d.created_at,
          patient_name: d.patient_name,
          patient_id: d.patient_id,
          doctor_name: d.doctor_name,
        }))}
        emptyMessage="Nenhum pedido de exame registrado ainda."
      />
    </>
  );
}
