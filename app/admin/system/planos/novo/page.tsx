import { requireSystemAdmin } from "@/lib/auth-helpers";
import { PlanoForm } from "../plano-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NovoPlanoPage() {
  await requireSystemAdmin();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/system/planos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Novo Plano</h1>
          <p className="text-muted-foreground mt-2">
            Crie um novo plano com limites e features personalizados
          </p>
        </div>
      </div>

      <PlanoForm />
    </div>
  );
}
