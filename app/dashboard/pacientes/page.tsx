import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PacientesClient, type Patient } from "./pacientes-client";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: rows } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, birth_date, notes, custom_fields, created_at")
    .eq("clinic_id", profile.clinic_id)
    .order("full_name");

  const { data: customFields } = await supabase
    .from("patient_custom_fields")
    .select("id, field_name, field_type, field_label, required, options, display_order")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order");

  const patients: Patient[] = (rows ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    birth_date: r.birth_date,
    notes: r.notes,
    custom_fields: (r.custom_fields as Record<string, unknown>) || {},
    created_at: r.created_at,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Pacientes</h1>
      <PacientesClient 
        initialPatients={patients} 
        customFields={customFields ?? []}
      />
    </div>
  );
}
