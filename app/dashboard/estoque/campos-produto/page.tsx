import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listProductFieldDefinitions } from "@/app/dashboard/estoque/product-field-actions";
import { ProductFieldsClient } from "./product-fields-client";
import Link from "next/link";

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Campos de produto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atributos personalizados por clínica (validade, registro, etc.).
          </p>
        </div>
        <Link href="/dashboard/estoque" className="text-sm text-primary hover:underline">
          Voltar ao estoque
        </Link>
      </div>
      <ProductFieldsClient initialFields={fields} />
    </div>
  );
}
