import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { SecretariaDashboard } from "./secretaria-dashboard";
import { MedicoDashboard } from "./medico-dashboard";
import AdminDashboard from "./admin-dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string; [key: string]: string | string[] | undefined }>;
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
          Crie sua clÃ­nica para comeÃ§ar a usar o FlowMedi. VocÃª serÃ¡ o
          administrador e poderÃ¡ convidar mÃ©dicos e SecretÃ¡rio(a)s depois.
        </p>
        <p className="text-muted-foreground text-sm">
          E-mail da conta: <strong>{user?.email}</strong>
        </p>
        <Link
          href="/dashboard/onboarding"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 px-4 py-2 hover:bg-primary/90"
        >
          Criar minha clÃ­nica
        </Link>
      </div>
    );
  }

  // Se for SecretÃ¡rio(a), usar dashboard especÃ­fico
  if (profile.role === "secretaria") {
    return <SecretariaDashboard profile={profile} />;
  }

  // Se for mÃ©dico, usar dashboard especÃ­fico
  if (profile.role === "medico") {
    return <MedicoDashboard profile={profile} />;
  }

  // Dashboard do admin: relatÃ³rios e mÃ©tricas
  return <AdminDashboard searchParams={searchParams} />;
}

