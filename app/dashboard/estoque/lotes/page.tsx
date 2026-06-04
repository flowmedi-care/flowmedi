import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listStockLots } from "@/app/dashboard/estoque/product-field-actions";
import { StockLotsClient } from "./stock-lots-client";
import Link from "next/link";

export default async function StockLotsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: lots } = await listStockLots();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Lotes e validade</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle por lote para produtos com rastreio de validade.
          </p>
        </div>
        <Link href="/dashboard/estoque" className="text-sm text-primary hover:underline">
          Voltar ao estoque
        </Link>
      </div>
      <StockLotsClient initialLots={lots} />
    </div>
  );
}
