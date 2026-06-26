import { requireSystemAdmin } from "@/lib/auth-helpers";
import { PlanoForm } from "../plano-form";
import { AppPageHeader } from "@/components/app-page-header";

export default async function NovoPlanoPage() {
  await requireSystemAdmin();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <AppPageHeader
        breadcrumbs={[
          { label: "Sistema", href: "/admin/system" },
          { label: "Planos", href: "/admin/system/planos" },
          { label: "Novo plano" },
        ]}
        backHref="/admin/system/planos"
        title="Novo Plano"
        description="Crie um novo plano com limites e features personalizados"
      />

      <PlanoForm />
    </div>
  );
}
