import { createClient } from "@/lib/supabase/server";
import { AdminDashboardClient } from "./admin-dashboard-client";
import { getMedicoDashboardData } from "./medico-dashboard-actions";
import { getDashboardPreferences } from "./preferences/actions";
import { getPipeline, syncNonRegisteredToPipeline } from "./pipeline/actions";

export type DoctorOption = { id: string; full_name: string | null };

export async function AdminDashboard({
  profile,
  searchParams,
}: {
  profile: { id: string; full_name: string | null; role: string; clinic_id: string };
  searchParams: Promise<{ view?: string; doctorId?: string }>;
}) {
  const params = await searchParams;
  const clinicId = profile.clinic_id;

  // Buscar médicos da clínica
  const supabase = await createClient();
  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  const doctorOptions: DoctorOption[] = (doctors ?? []).map((d) => ({
    id: d.id,
    full_name: d.full_name ?? null,
  }));

  const selectedDoctorId = params.doctorId || doctorOptions[0]?.id || null;
  const activeView = params.view === "medico" ? "medico" : "secretaria";

  // Dados da visão secretaria (sempre carregados)
  const secretariaData = await fetchSecretariaData(profile);

  // Dados da visão médico (apenas se houver médico selecionado)
  let medicoData = null;
  if (selectedDoctorId) {
    const res = await getMedicoDashboardData(selectedDoctorId, clinicId);
    medicoData = res.data;
  }

  return (
    <AdminDashboardClient
      activeView={activeView}
      doctors={doctorOptions}
      selectedDoctorId={selectedDoctorId}
      secretariaData={secretariaData}
      medicoData={medicoData}
      clinicId={clinicId}
    />
  );
}

async function fetchSecretariaData(profile: { clinic_id: string }) {
  const supabase = await createClient();
  const clinicId = profile.clinic_id;

  const prefsRes = await getDashboardPreferences();
  const preferences = prefsRes.data || {
    show_compliance: true,
    show_metrics: true,
    show_pipeline: true,
    show_upcoming_appointments: true,
    show_recent_activity: false,
  };

  let complianceAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
  }> = [];
  let complianceDays: number | null = null;

  if (preferences.show_compliance) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("compliance_confirmation_days")
      .eq("id", clinicId)
      .single();
    complianceDays = clinic?.compliance_confirmation_days ?? null;

    if (complianceDays !== null && complianceDays >= 0) {
      const now = new Date();
      const deadlineDate = new Date(now);
      deadlineDate.setDate(deadlineDate.getDate() + complianceDays);
      deadlineDate.setHours(23, 59, 59, 999);

      const { data: appointments } = await supabase
        .from("appointments")
        .select(
          `id, scheduled_at, patient:patients ( full_name ), doctor:profiles ( full_name )`
        )
        .eq("clinic_id", clinicId)
        .eq("status", "agendada")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", deadlineDate.toISOString())
        .order("scheduled_at", { ascending: true });

      if (appointments) {
        complianceAppointments = appointments.map((a: any) => {
          const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
          const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
          return {
            id: String(a.id),
            scheduled_at: String(a.scheduled_at),
            patient: { full_name: String(patient?.full_name ?? "") },
            doctor: { full_name: doctor?.full_name ?? null },
          };
        });
      }
    }
  }

  let metrics = null;
  if (preferences.show_metrics) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { count: appointmentsToday } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    const { count: pipelineCount } = await supabase
      .from("non_registered_pipeline")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .neq("stage", "registrado")
      .neq("stage", "arquivado");

    const { data: upcomingAppointmentsData } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", nextWeek.toISOString());
    const appointmentIds = (upcomingAppointmentsData || []).map((a) => a.id);
    const { count: pendingForms } =
      appointmentIds.length > 0
        ? await supabase
            .from("form_instances")
            .select("*", { count: "exact", head: true })
            .eq("status", "pendente")
            .in("appointment_id", appointmentIds)
        : { count: 0 };

    metrics = {
      appointmentsToday: appointmentsToday || 0,
      pipelineCount: pipelineCount || 0,
      pendingForms: pendingForms || 0,
      complianceCount: complianceAppointments.length,
    };
  }

  let upcomingAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
    status: string;
  }> = [];

  if (preferences.show_upcoming_appointments) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: appointments } = await supabase
      .from("appointments")
      .select(
        `id, scheduled_at, status, patient:patients ( full_name ), doctor:profiles ( full_name )`
      )
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at", { ascending: true });

    if (appointments) {
      upcomingAppointments = appointments.map((a: any) => {
        const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
        const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
        return {
          id: String(a.id),
          scheduled_at: String(a.scheduled_at),
          status: String(a.status),
          patient: { full_name: String(patient?.full_name ?? "") },
          doctor: { full_name: doctor?.full_name ?? null },
        };
      });
    }
  }

  let pipelineItems: any[] = [];
  if (preferences.show_pipeline) {
    await syncNonRegisteredToPipeline();
    const pipelineRes = await getPipeline();
    pipelineItems = pipelineRes.data || [];
  }

  return {
    complianceAppointments,
    complianceDays,
    metrics,
    upcomingAppointments,
    pipelineItems,
    preferences,
  };
}
