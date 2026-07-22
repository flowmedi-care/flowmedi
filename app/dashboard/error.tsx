"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold">Algo deu errado nesta tela</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        A operação da clínica continua — tente de novo ou volte às pendências do
        atendimento.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Tentar novamente</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm/jornada?view=pendencias">Ver pendências</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">Início</Link>
        </Button>
      </div>
    </div>
  );
}
