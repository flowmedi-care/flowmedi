import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listAllBankAccounts, listPaymentFeeRules } from "@/app/dashboard/financeiro/bank-account-actions";
import { ContasBancariasClient } from "./contas-bancarias-client";

export default async function ContasBancariasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [{ data: accounts }, { data: feeRules }] = await Promise.all([
    listAllBankAccounts(),
    listPaymentFeeRules(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Contas bancárias e taxas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contas de recebimento e taxas de cartão para o caixa refletir valores líquidos.
        </p>
      </div>
      <ContasBancariasClient initialAccounts={accounts} initialFeeRules={feeRules} />
    </div>
  );
}
