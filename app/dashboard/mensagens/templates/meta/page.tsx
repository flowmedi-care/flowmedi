import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app-page-header";
import { getClinicMetaMessageModels } from "../../actions";
import { MetaModelsClient } from "../meta-models-client";

export const dynamic = "force-dynamic";

export default async function TemplatesMetaPage() {
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

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const modelsResult = await getClinicMetaMessageModels();

  return (
    <div className="space-y-6">
      <AppPageHeader
        breadcrumbs={[
          { label: "Templates", href: "/dashboard/mensagens/templates" },
          { label: "Meta" },
        ]}
        backHref="/dashboard/mensagens/templates"
        title="Modelos de mensagens Meta"
        description="Crie modelos e envie para aprovação na Meta."
      />

      {modelsResult.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {modelsResult.error}
        </div>
      ) : null}

      <MetaModelsClient initialModels={modelsResult.data ?? []} />
    </div>
  );
}
