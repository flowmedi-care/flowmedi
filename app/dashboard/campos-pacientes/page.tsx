import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CamposPacientesClient } from "./campos-pacientes-client";

export default async function CamposPacientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: fields } = await supabase
    .from("patient_custom_fields")
    .select("id, field_name, field_type, field_label, required, options, display_order, include_in_public_form")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Campos de Pacientes</h1>
      <p className="text-sm text-muted-foreground">
        Adicione campos customizados para o cadastro de pacientes. Estes campos aparecerão para todos os membros da clínica.
      </p>
      <CamposPacientesClient initialFields={fields ?? []} />
    </div>
  );
}
