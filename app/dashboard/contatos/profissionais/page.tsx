import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EquipeClient } from "../../equipe/equipe-client";
import { WhatsAppRoutingSection } from "../../configuracoes/whatsapp-routing-section";
import { AppPageHeader } from "@/components/app-page-header";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";

export default async function ProfissionaisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, active")
    .eq("id", user.id)
    .single();

  if (!myProfile?.clinic_id) redirect("/dashboard");

  const clinicId = myProfile.clinic_id;
  const isAdmin = myProfile.role === "admin" && myProfile.active !== false;

  const { data: membersRaw } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, specialty, crm, crm_uf, active, created_at")
    .eq("clinic_id", clinicId)
    .in("role", ["medico", "secretaria", "admin"])
    .order("full_name");

  const members = (membersRaw ?? []).filter((p) => p.active !== false);

  if (isAdmin) {
    const { data: invitesRaw } = await supabase
      .from("invites")
      .select("id, email, role, expires_at, created_at")
      .eq("clinic_id", clinicId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    const memberEmails = new Set(
      (members ?? []).map((m) => m.email?.toLowerCase()).filter(Boolean)
    );
    const invites = (invitesRaw ?? []).filter(
      (i) => !memberEmails.has(i.email?.toLowerCase() ?? "")
    );

    const { data: secretaries } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("clinic_id", clinicId)
      .eq("role", "secretaria")
      .order("full_name");

    const { data: doctors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("role", "medico")
      .order("full_name");

    const { data: secretaryDoctors } = await supabase
      .from("secretary_doctors")
      .select("secretary_id, doctor_id")
      .eq("clinic_id", clinicId);

    const bySecretary: Record<string, string[]> = {};
    for (const row of secretaryDoctors ?? []) {
      if (!bySecretary[row.secretary_id]) bySecretary[row.secretary_id] = [];
      bySecretary[row.secretary_id].push(row.doctor_id);
    }

    return (
      <div className="space-y-6">
        <div className="surface-elevated px-4 sm:px-6 pt-5 sm:pt-6 pb-5">
          <AppPageHeader
            breadcrumbs={[{ label: "Profissionais" }]}
            title="Profissionais"
            description="Equipe da clínica — convites, papéis e vínculos secretária/médico."
            variant="contained"
          />
        </div>
        <EquipeClient
          clinicId={clinicId}
          members={members.map((m) => ({
            id: m.id,
            email: m.email ?? "",
            full_name: m.full_name,
            role: m.role,
            created_at: m.created_at ?? "",
            active: m.active,
          }))}
          invites={invites}
          currentUserId={user.id}
          secretariasMedicos={{
            secretaries: (secretaries ?? []).map((s) => ({
              id: s.id,
              full_name: s.full_name ?? "",
              email: s.email ?? undefined,
            })),
            doctors: (doctors ?? []).map((d) => ({
              id: d.id,
              full_name: d.full_name ?? "",
            })),
            initialAssignments: bySecretary,
          }}
        />
        <WhatsAppRoutingSection clinicId={clinicId} />
      </div>
    );
  }

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Profissionais" }],
        title: "Profissionais",
        description: "Profissionais e equipe administrativa da clínica.",
      }}
    >
      {members.length === 0 ? (
        <EmptyState title="Nenhum profissional cadastrado" />
      ) : (
        <ListPanel>
          {members.map((m) => (
            <ListPanelItem key={m.id}>
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{m.full_name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{m.email}</p>
                  {m.role === "medico" && (m.crm || m.specialty) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[m.specialty, m.crm && m.crm_uf ? `CRM ${m.crm}/${m.crm_uf}` : m.crm]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">
                  {m.role === "medico"
                    ? "Profissional"
                    : m.role === "secretaria"
                      ? "Secretário(a)"
                      : "Admin"}
                </Badge>
              </div>
            </ListPanelItem>
          ))}
        </ListPanel>
      )}
      {myProfile.role === "medico" && (
        <Link href="/dashboard/perfil">
          <Button variant="outline">Meu perfil profissional</Button>
        </Link>
      )}
    </PageShell>
  );
}
