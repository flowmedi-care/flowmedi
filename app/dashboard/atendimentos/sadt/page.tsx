import { Card, CardContent } from "@/components/ui/card";

export default function SadtPlaceholderPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Guia SP / SADT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Emissão de guias TISS para convênios e planos de saúde.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Este módulo está no roadmap do Flowmedi. Hoje o atendimento e a cobrança funcionam para
            consultas particulares e comandas. Quando integrarmos operadoras (ANS/TISS), as guias SP/SADT
            serão geradas aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
