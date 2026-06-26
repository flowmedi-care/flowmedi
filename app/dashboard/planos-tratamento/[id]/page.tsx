import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppPageHeader } from "@/components/app-page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtCurrency } from "@/lib/financeiro/format";

// RECORRÊNCIA v1 — Detalhe do plano (destino do toast pós-agendamento recorrente).
// Contrato: FLUXO-OPERACIONAL-COMPLETO.md § Parte 3
export default async function PlanoTratamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");
  if (profile.role === "medico") redirect("/dashboard/planos-tratamento");

  const { data: plan, error } = await supabase
    .from("treatment_plans")
    .select(
      `
      id,
      name,
      total_amount,
      paid_amount,
      sessions_total,
      sessions_used,
      payment_policy,
      status,
      created_at,
      patient:patients ( full_name )
    `
    )
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (error?.message.includes("treatment_plans")) {
    redirect("/dashboard/planos-tratamento");
  }
  if (!plan) notFound();

  const patient = Array.isArray(plan.patient) ? plan.patient[0] : plan.patient;
  const remainder = Math.max(0, Number(plan.total_amount) - Number(plan.paid_amount));
  const perSession = Number(plan.total_amount) / Math.max(1, Number(plan.sessions_total));

  const { data: linkedAppts } = await supabase
    .from("appointments")
    .select("id, session_number, scheduled_at, status")
    .eq("treatment_plan_id", id)
    .order("scheduled_at", { ascending: true });

  return (
    <div className="space-y-6 max-w-2xl">
      <AppPageHeader
        breadcrumbs={[
          { label: "Planos de tratamento", href: "/dashboard/planos-tratamento" },
          { label: plan.name },
        ]}
        backHref="/dashboard/planos-tratamento"
        title={plan.name}
        description={(patient as { full_name?: string })?.full_name ?? undefined}
      />
      <Card>
        <CardContent className="pt-6 space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{plan.status}</Badge>
            {plan.payment_policy && (
              <Badge variant="secondary">{plan.payment_policy}</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Valor total</p>
              <p className="font-semibold">{fmtCurrency(Number(plan.total_amount))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recebido</p>
              <p className="font-semibold">{fmtCurrency(Number(plan.paid_amount))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Saldo do plano</p>
              <p className="font-semibold">{fmtCurrency(remainder)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Por sessão (previsto)</p>
              <p className="font-semibold">{fmtCurrency(perSession)}</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Progresso: {plan.sessions_used}/{plan.sessions_total} sessões utilizadas
          </p>
          <p className="text-xs text-muted-foreground">
            DRE: receita reconhecida por sessão realizada (proporcional ao plano). Contas a
            receber usam o saldo do plano, não de cada consulta isolada.
          </p>
        </CardContent>
      </Card>

      {(linkedAppts?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Sessões na agenda</h2>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {linkedAppts!.map((a) => (
                <li key={a.id} className="py-2 flex justify-between gap-2">
                  <span>
                    Sessão {a.session_number ?? "—"} —{" "}
                    {new Date(a.scheduled_at).toLocaleString("pt-BR")} ({a.status})
                  </span>
                  <Link
                    href={`/dashboard/agenda/consulta/${a.id}`}
                    className="text-primary hover:underline shrink-0"
                  >
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
