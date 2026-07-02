import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listDataSubjectRequests } from "../dsar-actions";
import { DsarClient } from "./dsar-client";

export default async function PrivacidadeSolicitacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || !["admin", "secretaria"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const res = await listDataSubjectRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Solicitações de titulares</h1>
        <p className="text-sm text-muted-foreground">
          Registro de pedidos de acesso, correção, exclusão e portabilidade (LGPD art. 18).
        </p>
      </div>
      <DsarClient
        initialRequests={(res.data ?? []) as Parameters<typeof DsarClient>[0]["initialRequests"]}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
