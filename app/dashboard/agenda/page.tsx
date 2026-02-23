import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgendaClient, type AppointmentRow } from "./agenda-client";

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, preferences, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const preferences = (profile?.preferences as Record<string, unknown>) || {};

  const clinicId = profile.clinic_id;

  // Secretária: médicos que ela administra (para filtrar appointments e lista de médicos)
  let allowedDoctorIds: string[] = [];
  if (profile?.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", user.id);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  // Suporte a navegação por semana/mês: ~4 meses (1 antes, 3 à frente)
  const now = new Date();
  const startRange = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endRange = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59, 999);

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      patient:patients ( id, full_name ),
      doctor:profiles ( id, full_name ),
      appointment_type:appointment_types ( id, name )
    `
    )
    .eq("clinic_id", clinicId)
    .neq("status", "cancelada")
    .gte("scheduled_at", startRange.toISOString())
    .lte("scheduled_at", endRange.toISOString())
    .order("scheduled_at");

  if (profile?.role === "medico") {
    appointmentsQuery = appointmentsQuery.eq("doctor_id", user.id);
  } else if (profile?.role === "secretaria" && allowedDoctorIds.length > 0) {
    appointmentsQuery = appointmentsQuery.in("doctor_id", allowedDoctorIds);
  }

  const { data: appointments } = await appointmentsQuery;

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, email")
    .eq("clinic_id", clinicId)
    .order("full_name");

  const { data: doctorsRaw } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  // Secretária: médicos que ela administra (allowedDoctorIds já carregado). Vazio = todos.
  // Médico: mostrar só ele na lista.
  let doctors = doctorsRaw ?? [];
  if (profile?.role === "secretaria" && allowedDoctorIds.length > 0) {
    doctors = doctors.filter((d) => allowedDoctorIds.includes(d.id));
  } else if (profile?.role === "medico") {
    doctors = doctors.filter((d) => d.id === user.id);
  }

  const { data: appointmentTypes } = await supabase
    .from("appointment_types")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name");

  const { data: procedures } = await supabase
    .from("procedures")
    .select("id, name, recommendations")
    .eq("clinic_id", clinicId)
    .order("display_order", { ascending: true });

  const { data: formTemplates } = await supabase
    .from("form_templates")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name");

  const rows: AppointmentRow[] = (appointments ?? []).map((a: Record<string, unknown>) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const appointmentType = Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type;
    const procedure = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    const formInstances = Array.isArray(a.form_instances) ? a.form_instances : [];
    return {
      id: String(a.id ?? ""),
      scheduled_at: String(a.scheduled_at ?? ""),
      status: String(a.status ?? ""),
      notes: a.notes != null ? String(a.notes) : null,
      patient: {
        id: String((patient as { id?: unknown })?.id ?? ""),
        full_name: String((patient as { full_name?: unknown })?.full_name ?? ""),
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
        ? { id: String((procedure as { id?: unknown })?.id ?? ""), name: String((procedure as { name?: unknown })?.name ?? "") }
        : null,
      form_instances: formInstances.map((fi: { id?: unknown; status?: unknown }) => ({
        id: String(fi?.id ?? ""),
        status: String(fi?.status ?? ""),
      })),
    };
  });

  return (
    <div className="space-y-4">
      <AgendaClient
        appointments={rows}
        patients={(patients ?? []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email || undefined,
        }))}
        doctors={(doctors ?? []).map((d) => ({
          id: d.id,
          full_name: d.full_name,
        }))}
        appointmentTypes={(appointmentTypes ?? []).map((t) => ({
          id: t.id,
          name: t.name,
        }))}
        procedures={(procedures ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          recommendations: p.recommendations ?? null,
        }))}
        formTemplates={(formTemplates ?? []).map((f) => ({ id: f.id, name: f.name }))}
        initialPreferences={{
          viewMode: (preferences.agenda_view_mode as "timeline" | "calendar") || "timeline",
          timelineGranularity: (preferences.agenda_timeline_granularity as "day" | "week" | "month") || "day",
          calendarGranularity: (preferences.agenda_calendar_granularity as "week" | "month") || "week",
          statusFilter: (preferences.agenda_status_filter as string[]) || [],
          formFilter: (preferences.agenda_form_filter as "confirmados_sem_formulario" | "confirmados_com_formulario" | null) || null,
        }}
      />
    </div>
  );
}
