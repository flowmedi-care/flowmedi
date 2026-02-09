import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function FormulariosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Formulários</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Construtor de formulários, vínculo com tipo de consulta, links
            únicos e status (pendente, respondido, incompleto).
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Módulo de formulários em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
