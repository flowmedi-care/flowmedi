import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AppPageHeader } from "@/components/app-page-header";
import { PlanoDetalheClient } from "./plano-detalhe-client";

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
  if (profile.role === "medico") redirect("/dashboard/servicos-valores/servicos?tab=planos");

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
      patient_id,
      patient:patients ( full_name )
    `
    )
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (error?.message.includes("treatment_plans")) {
    redirect("/dashboard/servicos-valores/servicos?tab=planos");
  }
  if (!plan) notFound();

  const patient = Array.isArray(plan.patient) ? plan.patient[0] : plan.patient;
  const patientName = (patient as { full_name?: string })?.full_name ?? "Paciente";
  const perSession = Number(plan.total_amount) / Math.max(1, Number(plan.sessions_total));

  const { data: linkedAppts } = await supabase
    .from("appointments")
    .select("id, session_number, scheduled_at, status")
    .eq("treatment_plan_id", id)
    .order("scheduled_at", { ascending: true });

  const apptIds = (linkedAppts ?? []).map((a) => a.id as string);
  const comandaByAppt = new Map<string, { status: string; id: string; session_revenue_amount: number | null }>();
  if (apptIds.length > 0) {
    const { data: comandas } = await supabase
      .from("comandas")
      .select("id, appointment_id, status, session_revenue_amount")
      .in("appointment_id", apptIds)
      .neq("status", "cancelada");
    for (const c of comandas ?? []) {
      comandaByAppt.set(String(c.appointment_id), {
        status: String(c.status),
        id: String(c.id),
        session_revenue_amount: c.session_revenue_amount != null ? Number(c.session_revenue_amount) : null,
      });
    }
  }

  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .eq("active", true)
    .order("name");

  const sessions = (linkedAppts ?? []).map((a) => {
    const comanda = comandaByAppt.get(String(a.id));
    return {
      id: String(a.id),
      session_number: a.session_number != null ? Number(a.session_number) : null,
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      comanda_status: comanda?.status ?? null,
      comanda_id: comanda?.id ?? null,
      session_revenue: comanda?.session_revenue_amount ?? perSession,
      paid: comanda?.status === "paga",
    };
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <AppPageHeader
        breadcrumbs={[
          { label: "Serviços e valores", href: "/dashboard/servicos-valores/servicos?tab=planos" },
          { label: "Planos de tratamento", href: "/dashboard/servicos-valores/servicos?tab=planos" },
          { label: plan.name },
        ]}
        backHref="/dashboard/servicos-valores/servicos?tab=planos"
        title={plan.name}
        description={patientName}
      />
      <PlanoDetalheClient
        plan={{
          id: String(plan.id),
          name: String(plan.name),
          total_amount: Number(plan.total_amount),
          paid_amount: Number(plan.paid_amount),
          sessions_total: Number(plan.sessions_total),
          sessions_used: Number(plan.sessions_used),
          payment_policy: plan.payment_policy != null ? String(plan.payment_policy) : null,
          status: String(plan.status),
        }}
        patientId={String(plan.patient_id)}
        patientName={patientName}
        sessions={sessions}
        bankAccounts={(bankAccounts ?? []).map((b) => ({
          id: String(b.id),
          name: String(b.name),
        }))}
      />
    </div>
  );
}
