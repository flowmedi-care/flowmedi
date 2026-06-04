import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAllContacts } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  paciente: "Paciente",
  lead: "Lead",
  fornecedor: "Fornecedor",
  profissional: "Profissional",
};

export default async function TodosContatosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: contacts, error } = await listAllContacts();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Todos contatos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão unificada de pacientes, leads, fornecedores e profissionais.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <p className="text-sm font-medium">{(contacts ?? []).length} contato(s)</p>
        </CardHeader>
        <CardContent className="divide-y divide-border max-h-[70vh] overflow-y-auto">
          {(contacts ?? []).map((c) => (
            <div
              key={`${c.type}-${c.id}`}
              className="py-3 flex flex-wrap items-center justify-between gap-2 first:pt-0"
            >
              <div>
                {c.href ? (
                  <Link href={c.href} className="font-medium hover:text-primary">
                    {c.name}
                  </Link>
                ) : (
                  <p className="font-medium">{c.name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Badge variant="secondary">{TYPE_LABELS[c.type] ?? c.type}</Badge>
            </div>
          ))}
          {(contacts ?? []).length === 0 && !error && (
            <p className="text-sm text-muted-foreground py-4">Nenhum contato encontrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
