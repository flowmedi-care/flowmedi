"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateAppointment } from "../agenda/actions";

export type AppointmentPipelineStatus =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "falta"
  | "cancelada";

export type AppointmentPipelineItem = {
  id: string;
  status: AppointmentPipelineStatus;
  scheduled_at: string;
  patient_name: string;
  doctor_name: string | null;
  doctor_id: string;
  valor: number | null;
};

export type FunnelGranularity = "day" | "week";

export type LeadFunnelSnapshot = {
  novo_contato: number;
  aguardando_retorno: number;
  cadastrado: number;
  agendado: number;
};

export type LeadFunnelTimeBucket = {
  label: string;
  novos: number;
  cadastrados: number;
  agendados: number;
};

export type LeadFunnelMetrics = {
  snapshot: LeadFunnelSnapshot;
  total: number;
  taxaCadastro: number;
  taxaAgendamento: number;
  timeSeries: LeadFunnelTimeBucket[];
  periodDays: number;
};

export type AppointmentFunnelSnapshot = {
  agendadas: number;
  confirmadas: number;
  realizadas: number;
  faltas: number;
  canceladas: number;
};

export type AppointmentFunnelTimeBucket = {
  label: string;
  agendadas: number;
  confirmadas: number;
  realizadas: number;
  faltas: number;
  canceladas: number;
  taxaComparecimento: number;
};

export type AppointmentFunnelMetrics = {
  snapshot: AppointmentFunnelSnapshot;
  total: number;
  taxaConfirmacao: number;
  taxaComparecimento: number;
  taxaNoShow: number;
  timeSeries: AppointmentFunnelTimeBucket[];
  periodDays: number;
};

const APPOINTMENT_STATUSES: AppointmentPipelineStatus[] = [
  "agendada",
  "confirmada",
  "realizada",
  "falta",
  "cancelada",
];

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", supabase, profile: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", supabase, profile: null };
  }

  return { error: null, supabase, profile, userId: user.id };
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function formatBucketLabel(date: Date, granularity: FunnelGranularity): string {
  if (granularity === "day") {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function bucketKey(date: Date, granularity: FunnelGranularity): string {
  if (granularity === "day") {
    return date.toISOString().slice(0, 10);
  }
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
}

export async function getAppointmentPipeline(): Promise<{
  error: string | null;
  data: AppointmentPipelineItem[] | null;
}> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: null };

  const { supabase, profile, userId } = ctx;
  const clinicId = profile.clinic_id;

  const now = new Date();
  const activeStart = new Date(now);
  activeStart.setDate(activeStart.getDate() - 7);
  activeStart.setHours(0, 0, 0, 0);
  const activeEnd = new Date(now);
  activeEnd.setDate(activeEnd.getDate() + 30);
  activeEnd.setHours(23, 59, 59, 999);

  const terminalStart = new Date(now);
  terminalStart.setDate(terminalStart.getDate() - 14);
  terminalStart.setHours(0, 0, 0, 0);

  let allowedDoctorIds: string[] = [];
  if (profile.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", userId!);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  function applyDoctorFilter<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T }>(
    query: T
  ): T {
    if (profile!.role === "secretaria" && allowedDoctorIds.length > 0) {
      return query.in("doctor_id", allowedDoctorIds);
    }
    if (profile!.role === "secretaria" && allowedDoctorIds.length === 0) {
      return query.eq("doctor_id", "00000000-0000-0000-0000-000000000000");
    }
    return query;
  }

  const selectFields = `
    id,
    scheduled_at,
    status,
    valor,
    doctor_id,
    patient:patients ( full_name ),
    doctor:profiles!doctor_id ( full_name )
  `;

  let activeQuery = supabase
    .from("appointments")
    .select(selectFields)
    .eq("clinic_id", clinicId)
    .in("status", ["agendada", "confirmada"])
    .gte("scheduled_at", activeStart.toISOString())
    .lte("scheduled_at", activeEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  activeQuery = applyDoctorFilter(activeQuery);

  let terminalQuery = supabase
    .from("appointments")
    .select(selectFields)
    .eq("clinic_id", clinicId)
    .in("status", ["realizada", "falta", "cancelada"])
    .gte("scheduled_at", terminalStart.toISOString())
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: false });

  terminalQuery = applyDoctorFilter(terminalQuery);

  const [{ data: activeAppts }, { data: terminalAppts }] = await Promise.all([
    activeQuery,
    terminalQuery,
  ]);

  const allAppts = [...(activeAppts ?? []), ...(terminalAppts ?? [])];
  const seen = new Set<string>();

  const items: AppointmentPipelineItem[] = [];
  for (const a of allAppts) {
    if (seen.has(a.id as string)) continue;
    seen.add(a.id as string);
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const status = a.status as AppointmentPipelineStatus;
    if (!APPOINTMENT_STATUSES.includes(status)) continue;

    items.push({
      id: String(a.id),
      status,
      scheduled_at: String(a.scheduled_at),
      patient_name: (patient as { full_name?: string })?.full_name ?? "—",
      doctor_name: (doctor as { full_name?: string | null })?.full_name ?? null,
      doctor_id: String(a.doctor_id),
      valor: a.valor != null ? Number(a.valor) : null,
    });
  }

  items.sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  return { error: null, data: items };
}

export async function changeAppointmentPipelineStatus(
  appointmentId: string,
  newStatus: AppointmentPipelineStatus
): Promise<{ error: string | null }> {
  if (!APPOINTMENT_STATUSES.includes(newStatus)) {
    return { error: "Status inválido." };
  }

  const result = await updateAppointment(appointmentId, { status: newStatus });
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/crm/pipeline");
  return { error: null };
}

export async function getLeadFunnelMetrics(
  periodDays = 30,
  granularity: FunnelGranularity = periodDays <= 30 ? "day" : "week"
): Promise<{ error: string | null; data: LeadFunnelMetrics | null }> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: null };

  const { supabase, profile } = ctx;
  const clinicId = profile.clinic_id;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);
  start.setHours(0, 0, 0, 0);

  const { data: pipelineRows } = await supabase
    .from("non_registered_pipeline")
    .select("stage")
    .eq("clinic_id", clinicId);

  const snapshot: LeadFunnelSnapshot = {
    novo_contato: 0,
    aguardando_retorno: 0,
    cadastrado: 0,
    agendado: 0,
  };

  for (const row of pipelineRows ?? []) {
    const stage = row.stage as keyof LeadFunnelSnapshot;
    if (stage in snapshot) snapshot[stage]++;
  }

  const total = Object.values(snapshot).reduce((s, n) => s + n, 0);
  const entered = snapshot.novo_contato + snapshot.aguardando_retorno + snapshot.cadastrado + snapshot.agendado;

  const { data: clinicPipelineRows } = await supabase
    .from("non_registered_pipeline")
    .select("id")
    .eq("clinic_id", clinicId);

  const pipelineIds = (clinicPipelineRows ?? []).map((r) => r.id as string);

  const { data: historyRows } =
    pipelineIds.length > 0
      ? await supabase
          .from("non_registered_history")
          .select("action_type, new_stage, created_at, pipeline_id")
          .in("pipeline_id", pipelineIds)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
      : { data: [] };

  const buckets = new Map<string, LeadFunnelTimeBucket>();
  const pipelineFirstSeen = new Set<string>();

  for (const row of historyRows ?? []) {
    const date = new Date(row.created_at as string);
    const key = bucketKey(date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: formatBucketLabel(date, granularity),
        novos: 0,
        cadastrados: 0,
        agendados: 0,
      });
    }
    const bucket = buckets.get(key)!;

    if (row.action_type === "stage_change" && row.new_stage === "novo_contato") {
      const pid = row.pipeline_id as string;
      if (!pipelineFirstSeen.has(pid)) {
        pipelineFirstSeen.add(pid);
        bucket.novos++;
      }
    } else if (row.action_type === "stage_change" && row.new_stage === "cadastrado") {
      bucket.cadastrados++;
    } else if (row.action_type === "stage_change" && row.new_stage === "agendado") {
      bucket.agendados++;
    }
  }

  const { data: newPipelineRows } = await supabase
    .from("non_registered_pipeline")
    .select("id, created_at")
    .eq("clinic_id", clinicId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  for (const row of newPipelineRows ?? []) {
    const date = new Date(row.created_at as string);
    const key = bucketKey(date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: formatBucketLabel(date, granularity),
        novos: 0,
        cadastrados: 0,
        agendados: 0,
      });
    }
    if (!pipelineFirstSeen.has(row.id as string)) {
      buckets.get(key)!.novos++;
    }
  }

  const timeSeries = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  const cadastradosTotal = snapshot.cadastrado + snapshot.agendado;
  const agendadosTotal = snapshot.agendado;

  return {
    error: null,
    data: {
      snapshot,
      total,
      taxaCadastro: pct(cadastradosTotal, entered || total),
      taxaAgendamento: pct(agendadosTotal, cadastradosTotal || entered || total),
      timeSeries,
      periodDays,
    },
  };
}

export async function getAppointmentFunnelMetrics(
  periodDays = 30,
  granularity: FunnelGranularity = periodDays <= 30 ? "day" : "week"
): Promise<{ error: string | null; data: AppointmentFunnelMetrics | null }> {
  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: null };

  const { supabase, profile, userId } = ctx;
  const clinicId = profile.clinic_id;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);
  start.setHours(0, 0, 0, 0);

  let allowedDoctorIds: string[] = [];
  if (profile.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", userId!);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  let query = supabase
    .from("appointments")
    .select("status, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  if (profile.role === "secretaria" && allowedDoctorIds.length > 0) {
    query = query.in("doctor_id", allowedDoctorIds);
  } else if (profile.role === "secretaria" && allowedDoctorIds.length === 0) {
    query = query.eq("doctor_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: appointments } = await query;

  const snapshot: AppointmentFunnelSnapshot = {
    agendadas: 0,
    confirmadas: 0,
    realizadas: 0,
    faltas: 0,
    canceladas: 0,
  };

  const buckets = new Map<string, AppointmentFunnelTimeBucket>();

  for (const appt of appointments ?? []) {
    const status = appt.status as string;
    if (status === "agendada") snapshot.agendadas++;
    else if (status === "confirmada") snapshot.confirmadas++;
    else if (status === "realizada") snapshot.realizadas++;
    else if (status === "falta") snapshot.faltas++;
    else if (status === "cancelada") snapshot.canceladas++;

    const date = new Date(appt.scheduled_at as string);
    const key = bucketKey(date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: formatBucketLabel(date, granularity),
        agendadas: 0,
        confirmadas: 0,
        realizadas: 0,
        faltas: 0,
        canceladas: 0,
        taxaComparecimento: 0,
      });
    }
    const bucket = buckets.get(key)!;
    if (status === "agendada") bucket.agendadas++;
    else if (status === "confirmada") bucket.confirmadas++;
    else if (status === "realizada") bucket.realizadas++;
    else if (status === "falta") bucket.faltas++;
    else if (status === "cancelada") bucket.canceladas++;
  }

  const total = appointments?.length ?? 0;
  const confirmadasCount = snapshot.confirmadas + snapshot.realizadas + snapshot.faltas;
  const realizadasCount = snapshot.realizadas;

  const timeSeries = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => {
      const bucketTotal =
        v.agendadas + v.confirmadas + v.realizadas + v.faltas + v.canceladas;
      const confirmed = v.confirmadas + v.realizadas + v.faltas;
      return {
        ...v,
        taxaComparecimento: pct(v.realizadas, confirmed || bucketTotal),
      };
    });

  return {
    error: null,
    data: {
      snapshot,
      total,
      taxaConfirmacao: pct(confirmadasCount, total),
      taxaComparecimento: pct(realizadasCount, confirmadasCount || total),
      taxaNoShow: pct(snapshot.faltas, total),
      timeSeries,
      periodDays,
    },
  };
}
