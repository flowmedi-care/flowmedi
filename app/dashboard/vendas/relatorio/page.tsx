import { getVendasRelatorio } from "@/lib/vendas-reports";
import { FinanceiroReportClient } from "../../financeiro/financeiro-report-client";

export default async function VendasRelatorioPage() {
  const { data, error } = await getVendasRelatorio(90);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <FinanceiroReportClient
        title="Relatório de vendas"
        subtitle="Comandas dos últimos 90 dias."
        rows={(data ?? []).map((c) => ({
          data: new Date(c.created_at).toLocaleDateString("pt-BR"),
          paciente: c.patient_name,
          total: c.total_amount,
          pago: c.paid_amount,
          status: c.status,
        }))}
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "total", label: "Total", format: "currency" },
          { key: "pago", label: "Pago", format: "currency" },
          { key: "status", label: "Status" },
        ]}
      />
    </>
  );
}
