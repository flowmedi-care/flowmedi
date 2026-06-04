import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PipelineClient } from "../../pipeline/pipeline-client";
import { getPipeline, syncNonRegisteredToPipeline } from "../../pipeline/actions";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contatos de formulários públicos e links ainda não cadastrados como pacientes.
        </p>
      </div>
      {pipelineRes.error ? (
        <p className="text-sm text-destructive">{pipelineRes.error}</p>
      ) : (
        <PipelineClient initialItems={pipelineRes.data ?? []} />
      )}
    </div>
  );
}
