import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConsultaClient } from "./consulta-client";

export type ConsultaRow = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  patient: { id: string; full_name: string; phone: string | null };
  doctor: { id: string; full_name: string | null };
  appointment_type: { id: string; name: string } | null;
  procedure: { id: string; name: string } | null;
};

export default async function ConsultaPage() {
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

  // Amplo intervalo: 1 ano atrás até 2 anos à frente para listar todas as consultas
  const now = new Date();
  const startRange = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endRange = new Date(now.getFullYear() + 2, now.getMonth(), 0, 23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      patient:patients ( id, full_name, phone ),
      doctor:profiles ( id, full_name ),
      appointment_type:appointment_types ( id, name ),
      procedure:procedures ( id, name )
    `
    )
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startRange.toISOString())
    .lte("scheduled_at", endRange.toISOString())
    .order("scheduled_at", { ascending: true });

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

  const rows: ConsultaRow[] = (appointments ?? []).map((a: Record<string, unknown>) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const appointmentType = Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type;
    const procedure = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    const p = patient as { id?: unknown; full_name?: unknown; phone?: unknown } | null;
    return {
      id: String(a.id ?? ""),
      scheduled_at: String(a.scheduled_at ?? ""),
      status: String(a.status ?? ""),
      notes: a.notes != null ? String(a.notes) : null,
      patient: {
        id: String(p?.id ?? ""),
        full_name: String(p?.full_name ?? ""),
        phone: p?.phone != null ? String(p.phone) : null,
      },
      doctor: {
        id: String((doctor as { id?: unknown })?.id ?? ""),
        full_name: (doctor as { full_name?: unknown })?.full_name != null
          ? String((doctor as { full_name?: unknown }).full_name)
          : null,
      },
      appointment_type: appointmentType
        ? {
            id: String((appointmentType as { id?: unknown })?.id ?? ""),
            name: String((appointmentType as { name?: unknown })?.name ?? ""),
          }
        : null,
      procedure: procedure
        ? {
            id: String((procedure as { id?: unknown })?.id ?? ""),
            name: String((procedure as { name?: unknown })?.name ?? ""),
          }
        : null,
    };
  });

  return (
    <div className="space-y-4">
      <ConsultaClient
        consultas={rows}
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
