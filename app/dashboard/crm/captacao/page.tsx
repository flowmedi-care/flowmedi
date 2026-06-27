import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { FormTemplatesGrid } from "@/components/forms/form-templates-grid";
import type { FormTemplateRow } from "@/components/forms/form-template-types";
import { slugify } from "@/lib/form-slug";

export default async function CrmCaptacaoPage() {
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

  if (!profile?.clinic_id || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard");
  }

  const { data: templatesRaw, error: templatesError } = await supabase
    .from("form_templates")
    .select(`
      id,
      name,
      slug,
      appointment_type_id,
      is_public,
      appointment_types ( name )
    `)
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name")
    .eq("id", profile.clinic_id)
    .single();

  const clinicSlug = clinic?.slug || slugify(clinic?.name || "clinica") || "clinica";

  const templates: FormTemplateRow[] = (templatesRaw ?? []).map((t: Record<string, unknown>) => {
    const at = Array.isArray(t.appointment_types) ? t.appointment_types[0] : t.appointment_types;
    const typeName = (at as { name?: string } | null)?.name ?? null;
    const publicSlug = (t.slug as string) || slugify(String(t.name)) || "formulario";
    const isPublic = Boolean(t.is_public ?? false);
    return {
      id: String(t.id),
      name: String(t.name),
      appointment_type_name: typeName,
      is_public: isPublic,
      publicUrl: isPublic ? `/f/public/${clinicSlug}/${publicSlug}` : null,
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
    <PageShell
      header={{
        breadcrumbs: [
          { label: "CRM", href: "/dashboard/crm/pipeline" },
          { label: "Formulários de captação" },
        ],
        title: "Formulários de captação",
        description: "Crie e gerencie formulários públicos e de pré-consulta que alimentam o pipeline.",
        actions: (
          <Link href="/dashboard/crm/captacao/novo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo formulário
            </Button>
          </Link>
        ),
      }}
    >
      <p className="text-sm text-muted-foreground mb-4">
        {templates.length} formulário(s) · marque como &quot;Uso público&quot; no editor para gerar links de captação
      </p>
      {templatesError && (
        <p className="mb-4 text-sm text-destructive">
          Erro ao carregar formulários: {templatesError.message}
        </p>
      )}
      <FormTemplatesGrid
        templates={templates}
        patients={patientOptions}
        editBasePath="/dashboard/crm/captacao"
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard/contatos/leads">
          <Button variant="outline">Ver pipeline de leads</Button>
        </Link>
      </div>
    </PageShell>
  );
}
