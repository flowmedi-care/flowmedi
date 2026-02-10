"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LogoUpload } from "../configuracoes/logo-upload";

export function PerfilClient({
  doctorLogoUrl,
  doctorLogoScale,
}: {
  doctorLogoUrl: string | null;
  doctorLogoScale: number;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Minha Logo</h2>
          <p className="text-sm text-muted-foreground">
            Sua logo aparecerá no final dos formulários enviados aos seus pacientes.
          </p>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogoUrl={doctorLogoUrl}
            currentScale={doctorLogoScale}
            type="doctor"
          />
        </CardContent>
      </Card>
    </div>
  );
}
