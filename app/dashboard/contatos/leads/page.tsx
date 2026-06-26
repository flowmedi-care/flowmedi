import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PipelineClient } from "../../pipeline/pipeline-client";
import { getPipeline, syncNonRegisteredToPipeline } from "../../pipeline/actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard/contatos/pacientes");
  }

  await syncNonRegisteredToPipeline();
  const pipelineRes = await getPipeline();

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Leads" }],
        title: "Leads",
        description:
          "Contatos de formulários públicos e links ainda não cadastrados como pacientes.",
      }}
      elevated={false}
    >
      {pipelineRes.error ? (
        <p className="text-sm text-destructive">{pipelineRes.error}</p>
      ) : (
        <div className="surface-elevated p-4 sm:p-6">
          <PipelineClient initialItems={pipelineRes.data ?? []} />
        </div>
      )}
    </PageShell>
  );
}
