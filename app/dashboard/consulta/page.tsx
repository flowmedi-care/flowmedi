import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConsultaClient } from "./consulta-client";

export type ConsultaRow = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  valor?: number | null;
  dimension_value_ids?: string[];
  intake_pendencies?: Array<{ goal_id: string; label: string; required: boolean }>;
  patient: { id: string; full_name: string; phone: string | null };
  doctor: { id: string; full_name: string | null };
  service_id: string | null;
  service_name: string | null;
  procedure: { id: string; name: string } | null;
};

export default async function ConsultaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const clinicId = profile.clinic_id;

  // Secretário(a): médicos que ela administra. Profissional: só suas consultas.
  let allowedDoctorIds: string[] = [];
  if (profile?.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", user.id);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  // Amplo intervalo: 1 ano atrás até 2 anos à frente para listar todas as consultas
  const now = new Date();
  const startRange = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endRange = new Date(now.getFullYear() + 2, now.getMonth(), 0, 23, 59, 59, 999);

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      intake_pendencies,
      patient:patients ( id, full_name, phone ),
      doctor:profiles!doctor_id ( id, full_name ),
      service_id,
      procedure:procedures!procedure_id ( id, name )
    `
    )
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startRange.toISOString())
    .lte("scheduled_at", endRange.toISOString())
    .order("scheduled_at", { ascending: true });

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
    if (!dimensionValueIdsByAppointment[row.appointment_id]) {
      dimensionValueIdsByAppointment[row.appointment_id] = [];
    }
    dimensionValueIdsByAppointment[row.appointment_id].push(row.dimension_value_id);
  }

  const { data: doctorsRaw } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  let doctors = doctorsRaw ?? [];
  if (profile?.role === "secretaria" && allowedDoctorIds.length > 0) {
    doctors = doctors.filter((d) => allowedDoctorIds.includes(d.id));
  } else if (profile?.role === "medico") {
    doctors = doctors.filter((d) => d.id === user.id);
  }

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .order("full_name");

  const { data: services } = await supabase
    .from("services")
    .select("id, nome")
    .eq("clinic_id", clinicId)
    .order("nome");

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

  const { data: pricingDimensions } = await supabase
    .from("price_dimensions")
    .select("id, nome")
    .eq("clinic_id", clinicId)
    .eq("ativo", true)
    .order("nome");

  const { data: pricingDimensionValues } = await supabase
    .from("dimension_values")
    .select("id, dimension_id, nome")
    .eq("clinic_id", clinicId)
    .eq("ativo", true)
    .order("nome");

  const rows: ConsultaRow[] = (appointments ?? []).map((a: Record<string, unknown>) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const procedure = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    const svcId = a.service_id != null ? String(a.service_id) : null;
    const p = patient as { id?: unknown; full_name?: unknown; phone?: unknown } | null;
    const appointmentId = String(a.id ?? "");
    return {
      id: appointmentId,
      scheduled_at: String(a.scheduled_at ?? ""),
      status: String(a.status ?? ""),
      notes: a.notes != null ? String(a.notes) : null,
      service_id: svcId,
      service_name: svcId
        ? (services ?? []).find((s) => s.id === svcId)?.nome ?? null
        : null,
      valor: a.valor != null ? Number(a.valor) : null,
      dimension_value_ids: dimensionValueIdsByAppointment[appointmentId] ?? [],
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
        patients={(patients ?? []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
        }))}
        doctors={doctors.map((d) => ({
          id: d.id,
          full_name: d.full_name,
        }))}
        services={(services ?? []).map((s) => ({
          id: s.id,
          nome: s.nome,
        }))}
        procedures={(procedures ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          recommendations: p.recommendations ?? null,
        }))}
        formTemplates={(formTemplates ?? []).map((f) => ({
          id: f.id,
          name: f.name,
        }))}
        pricingDimensions={(pricingDimensions ?? []).map((d) => ({
          id: d.id,
          nome: d.nome,
        }))}
        pricingDimensionValues={(pricingDimensionValues ?? []).map((v) => ({
          id: v.id,
          dimension_id: v.dimension_id,
          nome: v.nome,
        }))}
      />
    </div>
  );
}

