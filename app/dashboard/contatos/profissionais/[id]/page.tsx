import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getProfessionalProfileBundle } from "../profile-actions";
import { ProfissionalPerfilClient } from "./profissional-perfil-client";

export default async function ProfissionalPerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { error, data: bundle } = await getProfessionalProfileBundle(id);
  if (error || !bundle) notFound();

  return <ProfissionalPerfilClient bundle={bundle} currentUserId={user.id} />;
}
