import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppPageHeader } from "@/components/app-page-header";
import { listProductFieldDefinitions } from "@/app/dashboard/estoque/product-field-actions";
import { ProductFieldsClient } from "./product-fields-client";

export default async function ProductFieldsPage() {
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
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { data: fields } = await listProductFieldDefinitions();

  return (
    <div className="space-y-4">
      <AppPageHeader
        breadcrumbs={[
          { label: "Estoque", href: "/dashboard/estoque" },
          { label: "Campos de produto" },
        ]}
        backHref="/dashboard/estoque"
        title="Campos de produto"
        description="Atributos personalizados por clínica (validade, registro, etc.)."
      />
      <ProductFieldsClient initialFields={fields} />
    </div>
  );
}
