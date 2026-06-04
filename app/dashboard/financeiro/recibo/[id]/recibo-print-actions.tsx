"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ReciboPrintActions() {
  return (
    <div className="flex gap-2 print:hidden">
      <Button type="button" onClick={() => window.print()} className="flex-1">
        Imprimir
      </Button>
      <Button variant="outline" asChild className="flex-1">
        <Link href="/dashboard/financeiro/receber">Voltar</Link>
      </Button>
    </div>
  );
}
