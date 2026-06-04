import { Card, CardContent } from "@/components/ui/card";

export default function VendasOrcamentosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Orçamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Propostas comerciais antes da comanda e do agendamento.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Módulo de orçamentos em desenvolvimento. Hoje a cobrança é feita via comanda ao finalizar
            o atendimento. Orçamentos permitirão enviar propostas ao paciente com validade e conversão
            em consulta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
