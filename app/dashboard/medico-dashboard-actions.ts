"use server";

import { createClient } from "@/lib/supabase/server";

export type Period = "daily" | "weekly" | "monthly" | "yearly";

export async function getDoctorMetricsByPeriod(
  doctorId: string,
  clinicId: string,
  period: Period
): Promise<{
  data: {
    total: number;
    completed: number;
    remaining: number;
    pendingForms: number;
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const now = new Date();

  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case "daily":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case "weekly":
      // Semana atual (domingo a sábado)
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "monthly":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "yearly":
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
  }

  // Buscar consultas do período
  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", startDate.toISOString())
    .lte("scheduled_at", endDate.toISOString());

  if (appointmentsError) {
    return { data: null, error: appointmentsError.message };
  }

  const appointmentsList = appointments || [];
  const total = appointmentsList.length;
  const completed = appointmentsList.filter((a) => a.status === "realizada").length;
  const remaining = total - completed;

  // Buscar formulários pendentes do período
  const appointmentIds = appointmentsList.map((a) => a.id);
  const { count: pendingForms } = appointmentIds.length > 0
    ? await supabase
        .from("form_instances")
        .select("*", { count: "exact", head: true })
        .in("appointment_id", appointmentIds)
        .in("status", ["pendente", "incompleto"])
    : { count: 0 };

  return {
    data: {
      total,
      completed,
      remaining,
      pendingForms: pendingForms || 0,
    },
    error: null,
  };
}

export async function getWeeklyAppointments(
  doctorId: string,
  clinicId: string
): Promise<{
  data: Array<{
    id: string;
    scheduled_at: string;
    status: string;
    patient: { full_name: string };
    appointment_type: { name: string } | null;
  }> | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const now = new Date();

  // Semana atual (domingo a sábado)
  const dayOfWeek = now.getDay();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - dayOfWeek);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      patient:patients ( full_name ),
      appointment_type:appointment_types ( name )
    `
    )
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", startDate.toISOString())
    .lte("scheduled_at", endDate.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  const processedAppointments = (appointments || []).map((a: any) => ({
    id: String(a.id),
    scheduled_at: String(a.scheduled_at),
    status: String(a.status),
    patient: {
      full_name: String(
        Array.isArray(a.patient) ? a.patient[0]?.full_name : a.patient?.full_name ?? ""
      ),
    },
    appointment_type: Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type,
  }));

  return { data: processedAppointments, error: null };
}

export type MedicoDashboardData = {
  appointments: Array<{
    id: string;
    scheduled_at: string;
    status: string;
    notes: string | null;
    patient: {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      birth_date: string | null;
    };
    appointment_type: { id: string; name: string } | null;
  }>;
  pendingForms: Array<{
    appointment_id: string;
    scheduled_at: string;
    patient_name: string;
    status: string;
  }>;
  metrics: {
    totalToday: number;
    completed: number;
    remaining: number;
    pendingForms: number;
  };
  nextAppointment: {
    id: string;
    scheduled_at: string;
    status: string;
    notes: string | null;
    patient: { id: string; full_name: string; email: string | null; phone: string | null; birth_date: string | null };
    appointment_type: { id: string; name: string } | null;
  } | null;
};

export async function getMedicoDashboardData(
  doctorId: string,
  clinicId: string
): Promise<{ data: MedicoDashboardData | null; error: string | null }> {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      patient:patients ( id, full_name, email, phone, birth_date ),
      appointment_type:appointment_types ( id, name )
    `
    )
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  if (appointmentsError) {
    return { data: null, error: appointmentsError.message };
  }

  const { data: formInstances } = await supabase
    .from("form_instances")
    .select(
      `
      id,
      status,
      appointment_id,
      appointments!inner (
        id,
        scheduled_at,
        patient:patients ( full_name ),
        doctor_id
      )
    `
    )
    .eq("appointments.doctor_id", doctorId)
    .eq("appointments.clinic_id", clinicId)
    .gte("appointments.scheduled_at", todayStart.toISOString())
    .lte("appointments.scheduled_at", todayEnd.toISOString())
    .in("status", ["pendente", "incompleto"]);

  const appointmentsToday = (appointments ?? []).map((a: any) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const appointmentType = Array.isArray(a.appointment_type)
      ? a.appointment_type[0]
      : a.appointment_type;
    return {
      id: String(a.id),
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      notes: a.notes || null,
      patient: {
        id: String(patient?.id ?? ""),
        full_name: String(patient?.full_name ?? ""),
        email: patient?.email ?? null,
        phone: patient?.phone ?? null,
        birth_date: patient?.birth_date ?? null,
      },
      appointment_type: appointmentType
        ? { id: String(appointmentType.id), name: String(appointmentType.name) }
        : null,
    };
  });

  const pendingForms = (formInstances ?? []).map((fi: any) => {
    const appointment = Array.isArray(fi.appointments) ? fi.appointments[0] : fi.appointments;
    const patient = Array.isArray(appointment?.patient)
      ? appointment.patient[0]
      : appointment?.patient;
    return {
      appointment_id: String(fi.appointment_id),
      scheduled_at: String(appointment?.scheduled_at ?? ""),
      patient_name: String(patient?.full_name ?? ""),
      status: String(fi.status),
    };
  });

  const completedCount = appointmentsToday.filter((a) => a.status === "realizada").length;
  const remainingCount = appointmentsToday.length - completedCount;
  const nextAppointment =
    appointmentsToday
      .filter((a) => a.status === "agendada" || a.status === "confirmada")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ||
    null;

  return {
    data: {
      appointments: appointmentsToday,
      pendingForms,
      metrics: {
        totalToday: appointmentsToday.length,
        completed: completedCount,
        remaining: remainingCount,
        pendingForms: pendingForms.length,
      },
      nextAppointment,
    },
    error: null,
  };
}
