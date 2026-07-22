import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";
import { getLeadsHubData } from "./actions";
import { LeadsHubClient } from "./leads-hub-client";

export default async function LeadsPage() {
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
    redirect("/dashboard/contatos/pacientes");
  }

  const hubRes = await getLeadsHubData();

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Leads" }],
        title: "Leads (lista de entrada)",
        description:
          "Lista operacional de contatos. O posto de trabalho do processo é o Workspace em Jornada.",
        actions: (
          <Button size="sm" asChild>
            <Link href="/dashboard/hoje">Abrir Hoje</Link>
          </Button>
        ),
      }}
    >
      {hubRes.error ? (
        <p className="text-sm text-destructive">{hubRes.error}</p>
      ) : hubRes.data ? (
        <LeadsHubClient data={hubRes.data} />
      ) : null}
    </PageShell>
  );
}
