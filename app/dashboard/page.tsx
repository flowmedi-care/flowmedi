import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Calendar, FileText, Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SecretariaDashboard } from "./secretaria-dashboard";
import { MedicoDashboard } from "./medico-dashboard";

export default async function DashboardPage() {
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

  const name = profile.full_name || user?.email?.split("@")[0] || "Usuário";

  // Se for secretária, usar dashboard específico
  if (profile.role === "secretaria") {
    return <SecretariaDashboard profile={profile} />;
  }

  // Se for médico, usar dashboard específico
  if (profile.role === "medico") {
    return <MedicoDashboard profile={profile} />;
  }

  // Dashboard padrão para admin
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {name}
        </h1>
        <p className="text-muted-foreground capitalize">Papel: {profile.role}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/agenda">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">Agenda</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ver consultas do dia, semana ou mês.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/pacientes">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-medium">Pacientes</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cadastro e histórico de pacientes.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/formularios">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">Formulários</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Formulários clínicos e status de preenchimento.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
