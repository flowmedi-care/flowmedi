import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PlanoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">
        Plano e pagamento
      </h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Apenas Admin: trocar de plano, cancelar assinatura, ver faturas,
            atualizar método de pagamento. Médicos e secretárias não veem esta
            área.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Integração de checkout em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
