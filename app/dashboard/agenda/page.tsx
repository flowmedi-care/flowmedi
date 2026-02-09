import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AgendaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Agenda</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Aqui será exibida a agenda (diária, semanal, mensal) por médico.
            Consultas com status: agendada, confirmada, realizada, falta.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Módulo de agenda em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
