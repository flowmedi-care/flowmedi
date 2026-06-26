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

export type CumulativeFunnelStage = {
  label: string;
  value: number;
  pct: number;
  step: number;
};

export type FunnelOutcomeBranch = {
  label: string;
  value: number;
  pct: number;
};

export type LeadFunnelMetrics = {
  snapshot: LeadFunnelSnapshot;
  total: number;
  taxaCadastro: number;
  taxaAgendamento: number;
  timeSeries: LeadFunnelTimeBucket[];
  cumulativeFunnel: CumulativeFunnelStage[];
  cohortSize: number;
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
  cumulativeFunnel: CumulativeFunnelStage[];
  outcomeBranches: FunnelOutcomeBranch[];
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

function isInPeriod(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

const LEAD_STAGE_RANK: Record<string, number> = {
  novo_contato: 0,
  aguardando_retorno: 1,
  cadastrado: 2,
  agendado: 3,
};

type HistoryRow = {
  action_type: string;
  new_stage: string | null;
  old_stage: string | null;
  created_at: string;
  pipeline_id: string;
};

function computeLeadMaxStage(
  currentStage: string | null,
  history: HistoryRow[]
): number {
  let max = LEAD_STAGE_RANK[currentStage ?? "novo_contato"] ?? 0;
  for (const row of history) {
    if (row.action_type === "stage_change" && row.new_stage) {
      max = Math.max(max, LEAD_STAGE_RANK[row.new_stage] ?? 0);
    }
    if (row.action_type === "registered") {
      max = Math.max(max, 2);
    }
  }
  return max;
}

function buildCumulativeStages(
  steps: { label: string; value: number }[]
): CumulativeFunnelStage[] {
  const top = steps[0]?.value ?? 0;
  return steps.map((step, index) => ({
    label: step.label,
    value: step.value,
    pct: index === 0 ? (top > 0 ? 100 : 0) : pct(step.value, top),
    step: index + 1,
  }));
}

async function buildLeadCumulativeFunnel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  start: Date,
  end: Date
): Promise<{ cohortSize: number; cumulativeFunnel: CumulativeFunnelStage[] }> {
  const { data: pipelineRows } = await supabase
    .from("non_registered_pipeline")
    .select("id, stage, created_at")
    .eq("clinic_id", clinicId);

  const cohortIds = new Set<string>();
  const currentStageById = new Map<string, string>();

  for (const row of pipelineRows ?? []) {
    const id = row.id as string;
    currentStageById.set(id, row.stage as string);
    const createdAt = new Date(row.created_at as string);
    if (isInPeriod(createdAt, start, end)) {
      cohortIds.add(id);
    }
  }

  const allPipelineIds = (pipelineRows ?? []).map((r) => r.id as string);

  const { data: historyInPeriod } =
    allPipelineIds.length > 0
      ? await supabase
          .from("non_registered_history")
          .select("pipeline_id, action_type, new_stage, old_stage, created_at")
          .in("pipeline_id", allPipelineIds)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
      : { data: [] };

  const orphanPipelineIds = new Set<string>();
  for (const row of historyInPeriod ?? []) {
    orphanPipelineIds.add(row.pipeline_id as string);
  }

  const idsForFullHistory = [...new Set([...allPipelineIds, ...orphanPipelineIds])];

  const { data: fullHistory } =
    idsForFullHistory.length > 0
      ? await supabase
          .from("non_registered_history")
          .select("pipeline_id, action_type, new_stage, old_stage, created_at")
          .in("pipeline_id", idsForFullHistory)
          .order("created_at", { ascending: true })
      : { data: [] };

  const historyByPipeline = new Map<string, HistoryRow[]>();
  for (const row of fullHistory ?? []) {
    const pid = row.pipeline_id as string;
    if (!historyByPipeline.has(pid)) historyByPipeline.set(pid, []);
    historyByPipeline.get(pid)!.push(row as HistoryRow);
  }

  for (const pid of idsForFullHistory) {
    if (cohortIds.has(pid)) continue;
    const entries = historyByPipeline.get(pid) ?? [];
    if (entries.length === 0) continue;
    const firstAt = new Date(entries[0].created_at);
    if (isInPeriod(firstAt, start, end)) {
      cohortIds.add(pid);
    }
  }

  let retornoOuMais = 0;
  let cadastradosOuMais = 0;
  let agendados = 0;

  for (const pid of cohortIds) {
    const maxStage = computeLeadMaxStage(
      currentStageById.get(pid) ?? null,
      historyByPipeline.get(pid) ?? []
    );
    if (maxStage >= 1) retornoOuMais++;
    if (maxStage >= 2) cadastradosOuMais++;
    if (maxStage >= 3) agendados++;
  }

  const cohortSize = cohortIds.size;
  const cumulativeFunnel = buildCumulativeStages([
    { label: "Entraram", value: cohortSize },
    { label: "Retorno ou mais", value: retornoOuMais },
    { label: "Cadastrados ou mais", value: cadastradosOuMais },
    { label: "Agendados", value: agendados },
  ]);

  return { cohortSize, cumulativeFunnel };
}

async function buildAppointmentCumulativeFunnel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  start: Date,
  end: Date,
  allowedDoctorIds: string[] | null,
  role: string
): Promise<{
  cumulativeFunnel: CumulativeFunnelStage[];
  outcomeBranches: FunnelOutcomeBranch[];
}> {
  let query = supabase
    .from("appointments")
    .select("id, status")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  if (role === "secretaria" && allowedDoctorIds && allowedDoctorIds.length > 0) {
    query = query.in("doctor_id", allowedDoctorIds);
  } else if (role === "secretaria") {
    query = query.eq("doctor_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: appointments } = await query;
  const appts = appointments ?? [];
  const total = appts.length;
  const apptIds = appts.map((a) => a.id as string);

  const confirmedIds = new Set<string>();
  for (const appt of appts) {
    const status = appt.status as string;
    if (status === "confirmada" || status === "realizada" || status === "falta") {
      confirmedIds.add(appt.id as string);
    }
  }

  if (apptIds.length > 0) {
    const { data: confirmEvents } = await supabase
      .from("event_timeline")
      .select("appointment_id")
      .eq("clinic_id", clinicId)
      .eq("event_code", "appointment_confirmed")
      .in("appointment_id", apptIds);

    for (const ev of confirmEvents ?? []) {
      if (ev.appointment_id) confirmedIds.add(ev.appointment_id as string);
    }
  }

  let realizadas = 0;
  let faltas = 0;
  let canceladas = 0;

  for (const appt of appts) {
    const status = appt.status as string;
    if (status === "realizada") realizadas++;
    else if (status === "falta") faltas++;
    else if (status === "cancelada") canceladas++;
  }

  const cumulativeFunnel = buildCumulativeStages([
    { label: "Agendadas", value: total },
    { label: "Confirmadas", value: confirmedIds.size },
    { label: "Realizadas", value: realizadas },
    { label: "Faltas", value: faltas },
    { label: "Canceladas", value: canceladas },
  ]);

  const outcomeBranches: FunnelOutcomeBranch[] = [
    { label: "Realizada", value: realizadas, pct: pct(realizadas, total) },
    { label: "Falta", value: faltas, pct: pct(faltas, total) },
    { label: "Cancelada", value: canceladas, pct: pct(canceladas, total) },
  ];

  return { cumulativeFunnel, outcomeBranches };
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

  const { cohortSize, cumulativeFunnel } = await buildLeadCumulativeFunnel(
    supabase,
    clinicId,
    start,
    end
  );

  return {
    error: null,
    data: {
      snapshot,
      total,
      taxaCadastro: pct(cadastradosTotal, entered || total),
      taxaAgendamento: pct(agendadosTotal, cohortSize || cadastradosTotal || entered || total),
      timeSeries,
      cumulativeFunnel,
      cohortSize,
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

  const { cumulativeFunnel, outcomeBranches } = await buildAppointmentCumulativeFunnel(
    supabase,
    clinicId,
    start,
    end,
    profile.role === "secretaria" ? allowedDoctorIds : null,
    profile.role
  );

  return {
    error: null,
    data: {
      snapshot,
      total,
      taxaConfirmacao: pct(confirmadasCount, total),
      taxaComparecimento: pct(realizadasCount, confirmadasCount || total),
      taxaNoShow: pct(snapshot.faltas, total),
      timeSeries,
      cumulativeFunnel,
      outcomeBranches,
      periodDays,
    },
  };
}
