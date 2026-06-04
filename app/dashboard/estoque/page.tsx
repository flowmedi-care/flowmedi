import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EstoqueClient } from "./estoque-client";
import { listProducts } from "./actions";
import { listExpiringStockLots } from "./product-field-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function EstoquePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") {
    redirect("/dashboard");
  }

  const { data: products, error } = await listProducts();
  const { data: expiringLots } = await listExpiringStockLots(30);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Controle de estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre insumos e materiais. O estoque comprometido é reservado ao agendar consultas com procedimentos vinculados.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <a href="/dashboard/estoque/lotes" className="text-primary hover:underline">
            Lotes e validade
          </a>
          {profile.role === "admin" && (
            <a href="/dashboard/estoque/campos-produto" className="text-primary hover:underline">
              Campos de produto
            </a>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {(expiringLots?.length ?? 0) > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">
              Alertas de validade (30 dias)
            </h2>
            <p className="text-sm text-muted-foreground">
              Lotes próximos do vencimento — alerta apenas, consumo não é bloqueado.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {expiringLots!.slice(0, 10).map((lot) => (
                <li key={lot.id}>
                  {lot.product_name} · lote {lot.lot_code} · validade{" "}
                  {lot.expiry_date
                    ? new Date(lot.expiry_date + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—"}{" "}
                  · {lot.quantity_on_hand} un.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <EstoqueClient initialProducts={products ?? []} isAdmin={profile.role === "admin"} />
    </div>
  );
}
