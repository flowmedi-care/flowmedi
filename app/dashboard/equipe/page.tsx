import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EquipeClient } from "./equipe-client";

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

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, expires_at, created_at")
    .eq("clinic_id", clinicId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Equipe</h1>
      <EquipeClient
        clinicId={clinicId}
        members={members ?? []}
        invites={invites ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
