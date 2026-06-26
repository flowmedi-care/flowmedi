import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Cake } from "lucide-react";
import { listBirthdaysToday } from "../actions";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { ContactListItem } from "@/components/dashboard-ui/contact-list";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

export default async function AniversariantesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: birthdays, error } = await listBirthdaysToday();
  const list = birthdays ?? [];

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Aniversariantes" }],
        title: "Aniversariantes",
        description: "Pacientes que fazem aniversário hoje.",
      }}
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm font-medium text-muted-foreground mb-4">
        Hoje — {list.length} paciente(s)
      </p>
      {list.length === 0 && !error ? (
        <EmptyState
          icon={Cake}
          title="Nenhum aniversariante hoje"
          description="Volte amanhã para ver quem faz aniversário."
        />
      ) : (
        <ListPanel>
          {list.map((p) => (
            <ListPanelItem key={p.id}>
              <Link href={`/dashboard/contatos/pacientes/${p.id}`} className="w-full">
                <ContactListItem
                  name={p.full_name}
                  subtitle={[p.phone, p.email].filter(Boolean).join(" · ")}
                />
              </Link>
            </ListPanelItem>
          ))}
        </ListPanel>
      )}
    </PageShell>
  );
}
