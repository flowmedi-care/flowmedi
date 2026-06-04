import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTreatmentPlans } from "@/app/dashboard/agenda/treatment-plan-actions";
import { PlanosTratamentoClient } from "./planos-tratamento-client";

export default async function PlanosTratamentoPage() {
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
  if (!profile || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard");
  }

  const { data: plans } = await listTreatmentPlans();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Planos de tratamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pacotes multi-sessão com pagamento antecipado, parcelado ou por consulta.
        </p>
      </div>
      <PlanosTratamentoClient initialPlans={plans} />
    </div>
  );
}
