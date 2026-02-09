import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FormulariosListClient } from "./formularios-list-client";

export default async function FormulariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: templatesRaw } = await supabase
    .from("form_templates")
    .select(`
      id,
      name,
      appointment_type_id,
      appointment_types ( name )
    `)
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  type TemplateRow = {
    id: string;
    name: string;
    appointment_type_name: string | null;
  };
  const templates: TemplateRow[] = (templatesRaw ?? []).map((t: Record<string, unknown>) => {
    const at = Array.isArray(t.appointment_types) ? t.appointment_types[0] : t.appointment_types;
    const typeName = (at as { name?: string } | null)?.name ?? null;
    return {
      id: String(t.id),
      name: String(t.name),
      appointment_type_name: typeName,
    };
  });

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", profile.clinic_id)
    .order("full_name");

  const patientOptions = (patients ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-foreground">Formulários</h1>
        <Link href="/dashboard/formularios/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo formulário
          </Button>
        </Link>
      </div>
      <FormulariosListClient templates={templates} patients={patientOptions} />
    </div>
  );
}
