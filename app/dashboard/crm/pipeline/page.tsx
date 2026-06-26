import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PipelineClient } from "../../pipeline/pipeline-client";
import { getPipeline, syncNonRegisteredToPipeline } from "../../pipeline/actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";

export default async function CrmPipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard");
  }

  await syncNonRegisteredToPipeline();
  const pipelineRes = await getPipeline();

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Pipeline" }],
        title: "Pipeline",
        description: "Acompanhe leads desde o primeiro contato até o agendamento.",
      }}
    >
      {pipelineRes.error ? (
        <p className="text-sm text-destructive">{pipelineRes.error}</p>
      ) : (
        <PipelineClient initialItems={pipelineRes.data ?? []} />
      )}
    </PageShell>
  );
}
