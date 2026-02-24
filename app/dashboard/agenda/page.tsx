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
      service_id,
      patient:patients ( id, full_name ),
      doctor:profiles!doctor_id ( id, full_name ),
      appointment_type:appointment_types ( id, name ),
      procedure:procedures ( id, name ),
      form_instances:form_instances ( id, status )
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
  const appointmentIds = (appointments ?? []).map((a: { id: string }) => a.id);

  let appointmentDimensionValues: { appointment_id: string; dimension_value_id: string }[] = [];
  if (appointmentIds.length > 0) {
    const { data: adv } = await supabase
      .from("appointment_dimension_values")
      .select("appointment_id, dimension_value_id")
      .in("appointment_id", appointmentIds);
    appointmentDimensionValues = adv ?? [];
  }
  const dimensionValueIdsByAppointment: Record<string, string[]> = {};
  for (const row of appointmentDimensionValues) {
    if (!dimensionValueIdsByAppointment[row.appointment_id]) dimensionValueIdsByAppointment[row.appointment_id] = [];
    dimensionValueIdsByAppointment[row.appointment_id].push(row.dimension_value_id);
  }

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

  const { data: services } = await supabase
    .from("services")
    .select("id, nome")
    .eq("clinic_id", clinicId)
    .order("nome");

  const { data: servicePrices } = await supabase
    .from("service_prices")
    .select("service_id, professional_id")
    .eq("clinic_id", clinicId)
    .eq("ativo", true);

  const { data: pricingDimensions } = await supabase
    .from("price_dimensions")
    .select("id, nome")
    .eq("clinic_id", clinicId)
    .eq("ativo", true)
    .order("nome");

  const { data: pricingDimensionValuesRaw } = await supabase
    .from("dimension_values")
    .select("id, dimension_id, nome, cor")
    .eq("clinic_id", clinicId)
    .eq("ativo", true)
    .order("nome");

  const { data: profileColorOverridesData } = await supabase
    .from("profile_dimension_value_colors")
    .select("dimension_value_id, cor")
    .eq("profile_id", user.id);
  const profileColorOverrides = profileColorOverridesData ?? [];
  const overrideMap: Record<string, string> = {};
  for (const row of profileColorOverrides) {
    overrideMap[row.dimension_value_id] = row.cor;
  }
  const pricingDimensionValues = (pricingDimensionValuesRaw ?? []).map((v: { id: string; dimension_id: string; nome: string; cor: string | null }) => ({
    id: v.id,
    dimension_id: v.dimension_id,
    nome: v.nome,
    cor: overrideMap[v.id] ?? v.cor ?? null,
  }));

  const { data: doctorProcedures } = await supabase
    .from("doctor_procedures")
    .select("doctor_id, procedure_id")
    .eq("clinic_id", clinicId);

  const rows: AppointmentRow[] = (appointments ?? []).map((a: Record<string, unknown>) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const appointmentType = Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type;
    const procedure = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    const formInstances = Array.isArray(a.form_instances) ? a.form_instances : [];
    const appointmentId = String(a.id ?? "");
    return {
      id: appointmentId,
      scheduled_at: String(a.scheduled_at ?? ""),
      status: String(a.status ?? ""),
      notes: a.notes != null ? String(a.notes) : null,
      service_id: a.service_id != null ? String(a.service_id) : null,
      dimension_value_ids: dimensionValueIdsByAppointment[appointmentId] ?? [],
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
        services={(services ?? []).map((s) => ({ id: s.id, nome: s.nome }))}
        pricingDimensions={(pricingDimensions ?? []).map((d) => ({ id: d.id, nome: d.nome }))}
        pricingDimensionValues={(pricingDimensionValues ?? []).map((v) => ({ id: v.id, dimension_id: v.dimension_id, nome: v.nome, cor: v.cor ?? null }))}
        servicePriceRules={(servicePrices ?? []).map((sp) => ({
          serviceId: String((sp as { service_id?: unknown }).service_id ?? ""),
          professionalId:
            (sp as { professional_id?: unknown }).professional_id != null
              ? String((sp as { professional_id?: unknown }).professional_id)
              : null,
        }))}
        doctorProcedures={(doctorProcedures ?? []).map((dp) => ({
          doctorId: String((dp as { doctor_id?: unknown }).doctor_id ?? ""),
          procedureId: String((dp as { procedure_id?: unknown }).procedure_id ?? ""),
        }))}
        initialPreferences={{
          viewMode: (preferences.agenda_view_mode as "timeline" | "calendar") || "timeline",
          timelineGranularity: (preferences.agenda_timeline_granularity as "day" | "week" | "month") || "day",
          calendarGranularity: (preferences.agenda_calendar_granularity as "week" | "month") || "week",
          statusFilter: (preferences.agenda_status_filter as string[]) || [],
          formFilter: (preferences.agenda_form_filter as "confirmados_sem_formulario" | "confirmados_com_formulario" | null) || null,
          filterByServiceId: (preferences.agenda_filter_by_service_id as string) || "",
          colorBy: (preferences.agenda_color_by as "status" | "dimension") || "status",
          colorByDimensionId: (preferences.agenda_color_by_dimension_id as string) || "",
        }}
      />
    </div>
  );
}
