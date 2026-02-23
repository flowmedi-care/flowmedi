import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import {
  Calendar,
  FileText,
  Users,
  AlertTriangle,
  UserPlus,
  Plus,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecretariaDashboardClient } from "./secretaria-dashboard-client";
import { getDashboardPreferences } from "./preferences/actions";
import { getPipeline, syncNonRegisteredToPipeline } from "./pipeline/actions";

export async function SecretariaDashboard({ profile }: { profile: any }) {
  const supabase = await createClient();
  const clinicId = profile.clinic_id;

  // Buscar preferências do dashboard
  const prefsRes = await getDashboardPreferences();
  const preferences = prefsRes.data || {
    show_compliance: true,
    show_metrics: true,
    show_pipeline: true,
    show_upcoming_appointments: true,
    show_recent_activity: false,
  };

  // Buscar compliance
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
          `
          id,
          scheduled_at,
          patient:patients ( full_name ),
          doctor:profiles ( full_name )
        `
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
            patient: {
              full_name: String(patient?.full_name ?? ""),
            },
            doctor: {
              full_name: doctor?.full_name ?? null,
            },
          };
        });
      }
    }
  }

  // Buscar métricas
  let metrics = null;
  if (preferences.show_metrics) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Consultas hoje
    const { count: appointmentsToday } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    // Não cadastrados no pipeline
    const { count: pipelineCount } = await supabase
      .from("non_registered_pipeline")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .neq("stage", "registrado")
      .neq("stage", "arquivado");

    // Formulários pendentes (próximos 7 dias)
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    // Buscar IDs de consultas dos próximos 7 dias
    const { data: upcomingAppointmentsData } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", nextWeek.toISOString());
    
    const appointmentIds = (upcomingAppointmentsData || []).map(a => a.id);
    
    const { count: pendingForms } = appointmentIds.length > 0
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

  // Buscar consultas do dia
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

    let appointmentsQuery = supabase
      .from("appointments")
      .select(
        `
        id,
        scheduled_at,
        status,
        patient:patients ( full_name ),
        doctor:profiles ( full_name )
      `
      )
      .eq("clinic_id", clinicId)
      .neq("status", "cancelada")
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .order("scheduled_at", { ascending: true });

    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", profile.id);
    const allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
    if (allowedDoctorIds.length > 0) {
      appointmentsQuery = appointmentsQuery.in("doctor_id", allowedDoctorIds);
    }

    const { data: appointments } = await appointmentsQuery;

    if (appointments) {
      upcomingAppointments = appointments.map((a: any) => {
        const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
        const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
        return {
          id: String(a.id),
          scheduled_at: String(a.scheduled_at),
          status: String(a.status),
          patient: {
            full_name: String(patient?.full_name ?? ""),
          },
          doctor: {
            full_name: doctor?.full_name ?? null,
          },
        };
      });
    }
  }

  // Buscar pipeline
  let pipelineItems: any[] = [];
  if (preferences.show_pipeline) {
    // Sincronizar primeiro
    await syncNonRegisteredToPipeline();
    const pipelineRes = await getPipeline();
    pipelineItems = pipelineRes.data || [];
  }

  // Consultas em andamento (médico chamou o paciente — started_at preenchido)
  let ongoingConsultations: Array<{
    id: string;
    scheduled_at: string;
    started_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
  }> = [];
  const { data: sdOngoing } = await supabase
    .from("secretary_doctors")
    .select("doctor_id")
    .eq("clinic_id", clinicId)
    .eq("secretary_id", profile.id);
  const allowedDoctorIdsOngoing = (sdOngoing ?? []).map((r) => r.doctor_id);
  let ongoingQuery = supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      started_at,
      patient:patients ( full_name ),
      doctor:profiles ( full_name )
    `
    )
    .eq("clinic_id", clinicId)
    .in("status", ["agendada", "confirmada"])
    .not("started_at", "is", null)
    .order("started_at", { ascending: false });
  if (allowedDoctorIdsOngoing.length > 0) {
    ongoingQuery = ongoingQuery.in("doctor_id", allowedDoctorIdsOngoing);
  }
  const { data: ongoing } = await ongoingQuery;
  if (ongoing) {
    ongoingConsultations = ongoing.map((a: any) => {
      const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
      const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
      return {
        id: String(a.id),
        scheduled_at: String(a.scheduled_at),
        started_at: String(a.started_at),
        patient: { full_name: String(patient?.full_name ?? "") },
        doctor: { full_name: doctor?.full_name ?? null },
      };
    });
  }

  return (
    <SecretariaDashboardClient
      complianceAppointments={complianceAppointments}
      complianceDays={complianceDays}
      metrics={metrics}
      upcomingAppointments={upcomingAppointments}
      pipelineItems={pipelineItems}
      preferences={preferences}
      ongoingConsultations={ongoingConsultations}
    />
  );
}
