import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VendasNotasFiscaisPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Notas fiscais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          NF-e / NFS-e de serviços prestados aos pacientes.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Integração fiscal para notas de pacientes ainda não está ativa. A nota da assinatura
            Flowmedi (SaaS) está disponível em Configurações → Assinatura.
          </p>
          <Link href="/dashboard/configuracoes/assinatura">
            <Button variant="outline" size="sm">
              Ver assinatura Flowmedi
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
