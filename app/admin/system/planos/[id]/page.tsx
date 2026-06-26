import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { PlanoForm } from "../plano-form";
import { AppPageHeader } from "@/components/app-page-header";

export default async function EditarPlanoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSystemAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !plan) {
    redirect("/admin/system/planos");
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <AppPageHeader
        breadcrumbs={[
          { label: "Sistema", href: "/admin/system" },
          { label: "Planos", href: "/admin/system/planos" },
          { label: plan.name },
        ]}
        backHref="/admin/system/planos"
        title="Editar Plano"
        description={`Configure os limites e features do plano ${plan.name}`}
      />

      <PlanoForm plan={plan} />
    </div>
  );
}
