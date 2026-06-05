import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireServicosValoresPageAccess() {
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

  if (!profile?.clinic_id || (profile.role !== "admin" && profile.role !== "medico")) {
    redirect("/dashboard");
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("services_pricing_mode")
    .eq("id", profile.clinic_id)
    .single();
  const servicesPricingMode =
    clinic?.services_pricing_mode === "centralizado" ? "centralizado" : "descentralizado";
  if (servicesPricingMode === "centralizado" && profile.role === "medico") {
    redirect("/dashboard");
  }

  return {
    supabase,
    user,
    profile,
    clinicId: profile.clinic_id,
    isAdmin: profile.role === "admin",
  };
}

export async function requireProcedimentosPageAccess() {
  const ctx = await requireServicosValoresPageAccess();
  if (!ctx.isAdmin) redirect("/dashboard/servicos-valores/servicos");
  return ctx;
}
