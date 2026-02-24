import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EquipeClient } from "./equipe-client";
import { WhatsAppRoutingSection } from "../configuracoes/whatsapp-routing-section";

export default async function EquipePage() {
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

  if (!myProfile || myProfile.role !== "admin" || myProfile.active === false) {
    redirect("/dashboard");
  }

  const clinicId = myProfile.clinic_id;

  const { data: membersRaw } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, active")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true });

  const members = (membersRaw ?? []).filter((p) => p.active !== false);

  const { data: invitesRaw } = await supabase
    .from("invites")
    .select("id, email, role, expires_at, created_at")
    .eq("clinic_id", clinicId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const memberEmails = new Set((members ?? []).map((m) => m.email?.toLowerCase()).filter(Boolean));
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
      <h1 className="text-xl font-semibold text-foreground">Equipe</h1>
      <EquipeClient
        clinicId={clinicId}
        members={members ?? []}
        invites={invites}
        currentUserId={user.id}
        secretariasMedicos={{
          secretaries: (secretaries ?? []).map((s) => ({
            id: s.id,
            full_name: s.full_name ?? "",
            email: s.email ?? undefined,
          })),
          doctors: (doctors ?? []).map((d) => ({ id: d.id, full_name: d.full_name ?? "" })),
          initialAssignments: bySecretary,
        }}
      />
      <WhatsAppRoutingSection clinicId={clinicId} />
    </div>
  );
}
