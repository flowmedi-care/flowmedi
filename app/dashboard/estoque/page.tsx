import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EstoqueClient } from "./estoque-client";
import { listProducts } from "./actions";

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
      <EstoqueClient initialProducts={products ?? []} isAdmin={profile.role === "admin"} />
    </div>
  );
}
