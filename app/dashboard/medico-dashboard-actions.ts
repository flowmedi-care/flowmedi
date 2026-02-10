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
