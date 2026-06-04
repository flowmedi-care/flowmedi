import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listSuppliers } from "../actions";
import { FornecedoresClient } from "./fornecedores-client";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard/contatos/pacientes");

  const { data: suppliers, error } = await listSuppliers();
  const canManage = profile.role === "admin" || profile.role === "secretaria";

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <FornecedoresClient
        initialSuppliers={suppliers ?? []}
        canManage={canManage}
      />
    </>
  );
}
