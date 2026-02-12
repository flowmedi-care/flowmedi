import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CamposProcedimentosClient } from "./campos-procedimentos-client";

export default async function CamposPacientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [fieldsRes, typesRes, proceduresRes] = await Promise.all([
    supabase
      .from("patient_custom_fields")
      .select("id, field_name, field_type, field_label, required, options, display_order, include_in_public_form")
      .eq("clinic_id", profile.clinic_id)
      .order("display_order"),
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes")
      .eq("clinic_id", profile.clinic_id)
      .order("name"),
    supabase
      .from("procedures")
      .select("id, name, recommendations, display_order")
      .eq("clinic_id", profile.clinic_id)
      .order("display_order", { ascending: true }),
  ]);

  const fields = fieldsRes.data ?? [];
  const appointmentTypes = (typesRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    duration_minutes: t.duration_minutes ?? 30,
  }));
  const procedures = (proceduresRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    recommendations: p.recommendations ?? null,
    display_order: p.display_order ?? 0,
  }));

  return (
    <CamposProcedimentosClient
      initialFields={fields}
      appointmentTypes={appointmentTypes}
      procedures={procedures}
    />
  );
}
