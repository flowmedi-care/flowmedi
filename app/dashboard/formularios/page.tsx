import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText, Plus, Pencil } from "lucide-react";

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
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Templates de formulário. Vincule a um tipo de consulta para que
            sejam aplicados automaticamente ao agendar.
          </p>
        </CardHeader>
        <CardContent>
          {!templates.length ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum formulário. Crie um para usar na agenda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3 first:pt-0"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{t.name}</span>
                    {t.appointment_type_name && (
                      <span className="text-sm text-muted-foreground">
                        → {t.appointment_type_name}
                      </span>
                    )}
                  </div>
                  <Link href={`/dashboard/formularios/${t.id}/editar`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
