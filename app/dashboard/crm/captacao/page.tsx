import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Formulários de captação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Formulários públicos que geram leads no pipeline.
          </p>
        </div>
        <Link href="/dashboard/configuracoes/campos-personalizados?tab=formularios">
          <Button variant="outline">Gerenciar formulários</Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm font-medium">{(forms ?? []).length} formulário(s) público(s)</p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(forms ?? []).map((f) => (
            <div key={f.id} className="py-3 flex flex-wrap justify-between gap-2 first:pt-0">
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
          ))}
          {(forms ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum formulário público. Marque um formulário como público em Formulários.
            </p>
          )}
        </CardContent>
      </Card>
      <Link href="/dashboard/contatos/leads">
        <Button>Ver pipeline de leads</Button>
      </Link>
    </div>
  );
}
