import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppPageHeader } from "@/components/app-page-header";
import { listStockLots } from "@/app/dashboard/estoque/product-field-actions";
import { StockLotsClient } from "./stock-lots-client";

export default async function StockLotsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: lots } = await listStockLots();

  return (
    <div className="space-y-4">
      <AppPageHeader
        breadcrumbs={[
          { label: "Estoque", href: "/dashboard/estoque" },
          { label: "Lotes e validade" },
        ]}
        backHref="/dashboard/estoque"
        title="Lotes e validade"
        description="Controle por lote para produtos com rastreio de validade."
      />
      <StockLotsClient initialLots={lots} />
    </div>
  );
}
