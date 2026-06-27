import { getVendasRelatorioDetalhado } from "@/lib/vendas-reports";
import { getPresetFunnelPeriod } from "@/lib/analytics/time-buckets";
import { VendasRelatorioClient } from "../vendas-relatorio-client";

export default async function VendasRelatorioPage() {
  const period = getPresetFunnelPeriod("90d");
  const { data, error } = await getVendasRelatorioDetalhado(period);

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Relatório de vendas</h1>
        <p className="text-sm text-destructive">{error ?? "Erro ao carregar dados."}</p>
      </div>
    );
  }

  return <VendasRelatorioClient initialData={data} />;
}
