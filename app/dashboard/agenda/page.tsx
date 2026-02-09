import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgendaClient } from "./agenda-client";

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const clinicId = profile.clinic_id;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 14);

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      patient:patients ( id, full_name ),
      doctor:profiles ( id, full_name ),
      appointment_type:appointment_types ( id, name ),
      form_instances ( id, status )
    `
    )
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startOfDay.toISOString())
    .lte("scheduled_at", endOfWeek.toISOString())
    .order("scheduled_at");

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .order("full_name");

  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  const { data: appointmentTypes } = await supabase
    .from("appointment_types")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name");

  const rows = (appointments ?? []).map((a: Record<string, unknown>) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    status: a.status,
    notes: a.notes,
    patient: Array.isArray(a.patient) ? a.patient[0] : a.patient,
    doctor: Array.isArray(a.doctor) ? a.doctor[0] : a.doctor,
    appointment_type: Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type,
    form_instances: a.form_instances ?? [],
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Agenda</h1>
      <AgendaClient
        appointments={rows}
        patients={(patients ?? []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
        }))}
        doctors={(doctors ?? []).map((d) => ({
          id: d.id,
          full_name: d.full_name,
        }))}
        appointmentTypes={(appointmentTypes ?? []).map((t) => ({
          id: t.id,
          name: t.name,
        }))}
      />
    </div>
  );
}
