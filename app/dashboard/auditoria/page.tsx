import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuditoriaClient } from "./auditoria-client";
import { getAuditLog } from "../reports/actions";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const res = await getAuditLog(profile.clinic_id, {
    userId: params.user || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    limit: 100,
  });

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("clinic_id", profile.clinic_id)
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Auditoria</h1>
        <p className="text-sm text-muted-foreground">Histórico de ações na clínica</p>
      </div>
      <AuditoriaClient
        initialLogs={res.data ?? []}
        members={members ?? []}
      />
    </div>
  );
}
