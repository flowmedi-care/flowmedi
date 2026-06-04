import { Card, CardContent } from "@/components/ui/card";

export default function VendasPacotesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Relatório de pacotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pacotes de tratamento e planos comerciais.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Pacotes de tratamento ainda não estão disponíveis. Quando lançarmos, você poderá
            vender pacotes fechados e acompanhar a utilização aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
