import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Apenas Admin: tipos de consulta, formulários padrão, gestão de
            usuários.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Módulo de configurações em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
