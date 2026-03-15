import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Modelos de mensagens Meta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie modelos e envie para aprovação na Meta.
          </p>
        </div>
        <Link href="/dashboard/mensagens/templates">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>

      {modelsResult.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {modelsResult.error}
        </div>
      ) : null}

      <MetaModelsClient initialModels={modelsResult.data ?? []} />
    </div>
  );
}
