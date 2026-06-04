import { getConsultationFunnel } from "../actions";
import { Card, CardContent } from "@/components/ui/card";

export default async function CrmFunilPage() {
  const { data, error } = await getConsultationFunnel(30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Funil de consultas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas operacionais de agendamento nos últimos 30 dias (diferente do pipeline de leads).
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Agendadas</p>
              <p className="text-2xl font-semibold">{data.agendadas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Confirmadas</p>
              <p className="text-2xl font-semibold">{data.confirmadas}</p>
              <p className="text-xs text-muted-foreground">{data.taxaConfirmacao}% confirmação</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Realizadas</p>
              <p className="text-2xl font-semibold">{data.compareceram}</p>
              <p className="text-xs text-muted-foreground">{data.taxaComparecimento}% comparecimento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Faltas (no-show)</p>
              <p className="text-2xl font-semibold">{data.noShow}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Canceladas</p>
              <p className="text-2xl font-semibold">{data.canceladas}</p>
            </CardContent>
          </Card>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Para análises detalhadas por profissional, use a aba Relatórios no Início (admin).
      </p>
    </div>
  );
}
