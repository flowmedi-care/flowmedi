import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

export default async function CrmCaptacaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || (profile.role !== "admin" && profile.role !== "secretaria")) {
    redirect("/dashboard");
  }

  const { data: forms } = await supabase
    .from("form_templates")
    .select("id, name, slug, is_public, created_at")
    .eq("clinic_id", profile.clinic_id)
    .eq("is_public", true)
    .order("name");

  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug")
    .eq("id", profile.clinic_id)
    .single();

  const formList = forms ?? [];

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Formulários de captação" }],
        title: "Formulários de captação",
        description: "Formulários públicos que geram leads no pipeline.",
        actions: (
          <Link href="/dashboard/configuracoes/campos-personalizados?tab=formularios">
            <Button variant="outline">Gerenciar formulários</Button>
          </Link>
        ),
      }}
    >
      <p className="text-sm font-medium text-muted-foreground mb-4">
        {formList.length} formulário(s) público(s)
      </p>
      {formList.length === 0 ? (
        <EmptyState
          title="Nenhum formulário público"
          description="Marque um formulário como público em Formulários."
        />
      ) : (
        <ListPanel>
          {formList.map((f) => (
            <ListPanelItem key={f.id}>
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{f.name}</p>
                  {clinic?.slug && f.slug && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      /f/public/{clinic.slug}/{f.slug}
                    </p>
                  )}
                </div>
                {clinic?.slug && f.slug && (
                  <a
                    href={`/f/public/${clinic.slug}/${f.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>
                  </a>
                )}
              </div>
            </ListPanelItem>
          ))}
        </ListPanel>
      )}
      <Link href="/dashboard/contatos/leads">
        <Button className="mt-4">Ver pipeline de leads</Button>
      </Link>
    </PageShell>
  );
}
