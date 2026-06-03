import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FinanceiroClient } from "./financeiro-client";
import { listFinancialEntries, getFinancialSummary } from "./actions";
import { listOpenComandas } from "../agenda/encounter-actions";

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard");

  const [{ data: entries, error }, { summary }, { data: openComandas }] = await Promise.all([
    listFinancialEntries(),
    getFinancialSummary(),
    listOpenComandas(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fluxo de caixa da clínica: receitas de pacientes, despesas com fornecedores e contas a pagar/receber.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <FinanceiroClient
        initialEntries={entries ?? []}
        summary={summary ?? { recebido: 0, aReceber: 0, pago: 0, aPagar: 0 }}
        openComandas={openComandas ?? []}
        canManage={profile.role === "admin" || profile.role === "secretaria"}
      />
    </div>
  );
}
