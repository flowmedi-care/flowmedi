import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesSitePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Site da clínica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Página pública da clínica com formulários de captação.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            O site institucional completo (landing com hero, serviços e CTA) está previsto para uma
            próxima versão. Hoje você pode usar formulários públicos e as redes sociais configuradas
            em Dados da clínica.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/configuracoes/clinica">
              <Button variant="outline" size="sm">
                Dados e redes
              </Button>
            </Link>
            <Link href="/dashboard/crm/captacao">
              <Button variant="outline" size="sm">
                Formulários de captação
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
