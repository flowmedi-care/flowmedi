import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PerfilClient } from "./perfil-client";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, logo_url, logo_scale, clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  if (profile.role !== "medico") {
    redirect("/dashboard");
  }

  const clinicId = profile.clinic_id as string | null;
  let dimensions: { id: string; nome: string }[] = [];
  let dimensionValues: { id: string; dimension_id: string; nome: string; cor: string | null }[] = [];
  let colorOverrides: Record<string, string> = {};

  if (clinicId) {
    const [dimsRes, valsRes, overridesRes] = await Promise.all([
      supabase
        .from("price_dimensions")
        .select("id, nome")
        .eq("clinic_id", clinicId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("dimension_values")
        .select("id, dimension_id, nome, cor")
        .eq("clinic_id", clinicId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("profile_dimension_value_colors")
        .select("dimension_value_id, cor")
        .eq("profile_id", user.id),
    ]);
    dimensions = (dimsRes.data ?? []).map((d) => ({ id: d.id, nome: d.nome }));
    dimensionValues = (valsRes.data ?? []).map((v) => ({
      id: v.id,
      dimension_id: v.dimension_id,
      nome: v.nome,
      cor: v.cor ?? null,
    }));
    for (const r of overridesRes.data ?? []) {
      colorOverrides[r.dimension_value_id] = r.cor;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Meu Perfil</h1>
      <PerfilClient
        doctorLogoUrl={profile.logo_url ?? null}
        doctorLogoScale={profile.logo_scale ?? 100}
        agendaDimensionValues={dimensionValues}
        agendaDimensions={dimensions}
        agendaColorOverrides={colorOverrides}
      />
    </div>
  );
}
