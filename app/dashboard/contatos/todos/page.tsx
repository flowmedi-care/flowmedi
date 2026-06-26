import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listAllContacts } from "../actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

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
  const list = contacts ?? [];

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Todos contatos" }],
        title: "Todos contatos",
        description: "Visão unificada de pacientes, leads, fornecedores e profissionais.",
      }}
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm font-medium text-muted-foreground mb-4">
        {list.length} contato(s)
      </p>
      {list.length === 0 && !error ? (
        <EmptyState title="Nenhum contato encontrado" />
      ) : (
        <ListPanel className="max-h-[70vh] overflow-y-auto">
          {list.map((c) => (
            <ListPanelItem key={`${c.type}-${c.id}`}>
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
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
            </ListPanelItem>
          ))}
        </ListPanel>
      )}
    </PageShell>
  );
}
