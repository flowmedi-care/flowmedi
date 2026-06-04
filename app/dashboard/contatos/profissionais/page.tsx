import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EquipeClient } from "../../equipe/equipe-client";
import { WhatsAppRoutingSection } from "../../configuracoes/whatsapp-routing-section";

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
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Profissionais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Equipe da clínica — convites, papéis e vínculos secretária/médico.
          </p>
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Profissionais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Profissionais e equipe administrativa da clínica.
        </p>
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm font-medium">Equipe ({members.length})</p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {members.map((m) => (
            <div
              key={m.id}
              className="py-3 flex flex-wrap items-center justify-between gap-2 first:pt-0 last:pb-0"
            >
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
                {m.role === "medico" ? "Profissional" : m.role === "secretaria" ? "Secretário(a)" : "Admin"}
              </Badge>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Nenhum profissional cadastrado.</p>
          )}
        </CardContent>
      </Card>
      {myProfile.role === "medico" && (
        <Link href="/dashboard/perfil">
          <Button variant="outline">Meu perfil profissional</Button>
        </Link>
      )}
    </div>
  );
}
