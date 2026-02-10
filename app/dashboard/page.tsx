import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { SecretariaDashboard } from "./secretaria-dashboard";
import { MedicoDashboard } from "./medico-dashboard";
import { AdminDashboard } from "./admin-dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; doctorId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, clinic_id")
    .eq("id", user?.id ?? "")
    .single();

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <h1 className="text-xl font-semibold text-foreground">
          Complete seu cadastro
        </h1>
        <p className="text-muted-foreground text-sm">
          Crie sua clínica para começar a usar o FlowMedi. Você será o
          administrador e poderá convidar médicos e secretárias depois.
        </p>
        <p className="text-muted-foreground text-sm">
          E-mail da conta: <strong>{user?.email}</strong>
        </p>
        <p className="text-muted-foreground text-xs max-w-md mx-auto">
          Já tem clínica e mesmo assim vê esta tela? Pode ser permissão no
          banco. No Supabase, execute o script{" "}
          <code className="bg-muted px-1 rounded text-foreground">
            supabase/fix-profiles-ver-membros-clinica.sql
          </code>
          .
        </p>
        <Link
          href="/dashboard/onboarding"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 px-4 py-2 hover:bg-primary/90"
        >
          Criar minha clínica
        </Link>
      </div>
    );
  }

  // Se for secretária, usar dashboard específico
  if (profile.role === "secretaria") {
    return <SecretariaDashboard profile={profile} />;
  }

  // Se for médico, usar dashboard específico
  if (profile.role === "medico") {
    return <MedicoDashboard profile={profile} />;
  }

  // Dashboard do admin: visão secretaria + visão médico
  return <AdminDashboard profile={profile} searchParams={searchParams} />;
}
