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
        description:
          "Visão unificada de pacientes, leads, fornecedores e profissionais. Um contato pode ter múltiplas classificações.",
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
            <ListPanelItem key={`${c.primaryType}-${c.id}`}>
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
                <div className="flex flex-wrap gap-1 justify-end" title="Classificações do contato">
                  {c.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={tag === "Lead ativo" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {!c.tags.length && (
                    <Badge variant="secondary">
                      {TYPE_LABELS[c.primaryType] ?? c.primaryType}
                    </Badge>
                  )}
                </div>
              </div>
            </ListPanelItem>
          ))}
        </ListPanel>
      )}
    </PageShell>
  );
}
