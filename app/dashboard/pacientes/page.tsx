import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PacientesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Pacientes</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Cadastro de pacientes, histórico de consultas e consentimento LGPD.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Módulo de pacientes em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
