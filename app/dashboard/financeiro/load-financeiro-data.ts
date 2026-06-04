import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listFinancialEntries, getFinancialSummary } from "./actions";
import { listOpenComandas } from "../agenda/encounter-actions";

export async function loadFinanceiroPageData() {
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

  return {
    error,
    entries: entries ?? [],
    summary: summary ?? { recebido: 0, aReceber: 0, pago: 0, aPagar: 0 },
    openComandas: openComandas ?? [],
    canManage: profile.role === "admin" || profile.role === "secretaria",
  };
}
