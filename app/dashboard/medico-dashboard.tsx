import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MedicoDashboardClient } from "./medico-dashboard-client";
import { Clock, Calendar, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

export async function MedicoDashboard({ profile }: { profile: any }) {
  const supabase = await createClient();
  const clinicId = profile.clinic_id;
  const doctorId = profile.id;

  // Buscar consultas do dia atual (considerando timezone local)
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

  // Log para debug (remover em produção)
  if (appointmentsError) {
    console.error("Erro ao buscar consultas:", appointmentsError);
  }

  // Buscar formulários pendentes
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
    .gte("appointments.scheduled_at", today.toISOString())
    .lt("appointments.scheduled_at", tomorrow.toISOString())
    .in("status", ["pendente", "incompleto"]);

  // Processar consultas
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
        ? {
            id: String(appointmentType.id),
            name: String(appointmentType.name),
          }
        : null,
    };
  });

  // Processar formulários pendentes
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

  // Calcular métricas
  const now = new Date();
  const completedCount = appointmentsToday.filter(
    (a) => a.status === "realizada"
  ).length;
  const remainingCount = appointmentsToday.length - completedCount;
  const nextAppointment = appointmentsToday.find(
    (a) => new Date(a.scheduled_at) > now && a.status !== "cancelada"
  );

  const metrics = {
    totalToday: appointmentsToday.length,
    completed: completedCount,
    remaining: remainingCount,
    pendingForms: pendingForms.length,
  };

  return (
    <MedicoDashboardClient
      appointments={appointmentsToday}
      pendingForms={pendingForms}
      metrics={metrics}
      nextAppointment={nextAppointment || null}
    />
  );
}
