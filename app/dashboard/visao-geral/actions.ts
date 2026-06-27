"use server";

import { createClient } from "@/lib/supabase/server";

export type Period = "7d" | "30d" | "90d";

type RiskLabel = "alto" | "medio";

type PacienteRiscoNoShow = {
  patientId: string;
  full_name: string;
  phone: string | null;
  scheduled_at: string;
  riskScore: number;
  riskLabel: RiskLabel;
};

type HorarioOcioso = {
  hour: string;
  appointments: number;
  recommendation: string;
};

type GoalStatusLevel = "ok" | "warning" | "critical";

type GoalCard = {
  key: "confirmacao" | "comparecimento" | "noShow" | "ocupacao" | "retorno";
  label: string;
  current: number;
  target: number;
  status: GoalStatusLevel;
  trendVs30d: number;
};

type ReportGoalsConfig = {
  targetConfirmationPct: number;
  targetAttendancePct: number;
  targetNoShowPct: number;
  targetOccupancyPct: number;
  targetReturnPct: number;
  returnWindowDays: number;
  workingHoursStart: number;
  workingHoursEnd: number;
};

export type VisaoGeralChartPoint = {
  dateKey: string;
  date: string;
  total: number;
  realizadas: number;
  canceladas: number;
  faltas: number;
};

export type VisaoGeralData = {
  total: number;
  realizadas: number;
  canceladas: number;
  faltas: number;
  taxaComparecimento: number;
  taxaNoShow: number;
  crescimento: number;
  ticketMedioRealizadas: number;
  receitaPerdidaEstimada: number;
  pacientesRiscoNoShow: PacienteRiscoNoShow[];
  horariosOciosos: HorarioOcioso[];
  metas: GoalCard[];
  chartData: VisaoGeralChartPoint[];
};

export type VisaoGeralWeekProcedure = {
  id: string;
  name: string;
  duration_minutes: number;
  weekCount: number;
};

export type VisaoGeralWeekAppointment = {
  id: string;
  scheduled_at: string;
  status: string;
  patientName: string;
  doctorName: string;
  procedureIds: string[];
};

export type VisaoGeralWeekData = {
  weekStart: string;
  weekEnd: string;
  procedures: VisaoGeralWeekProcedure[];
  appointments: VisaoGeralWeekAppointment[];
};

function getSinglePatientRelation(
  patient: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null | undefined
) {
  if (!patient) return null;
  return Array.isArray(patient) ? patient[0] ?? null : patient;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function calcGoalStatus(current: number, target: number, higherIsBetter: boolean): GoalStatusLevel {
  if (higherIsBetter) {
    if (current >= target) return "ok";
    if (current >= target - 10) return "warning";
    return "critical";
  }
  if (current <= target) return "ok";
  if (current <= target + 3) return "warning";
  return "critical";
}

function getDefaultReportGoals(): ReportGoalsConfig {
  return {
    targetConfirmationPct: 85,
    targetAttendancePct: 80,
    targetNoShowPct: 8,
    targetOccupancyPct: 75,
    targetReturnPct: 60,
    returnWindowDays: 30,
    workingHoursStart: 8,
    workingHoursEnd: 18,
  };
}

async function getClinicGoalsConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string
): Promise<ReportGoalsConfig> {
  const defaults = getDefaultReportGoals();
  const { data: goalsRow } = await supabase
    .from("clinic_report_goals")
    .select(
      `
      target_confirmation_pct,
      target_attendance_pct,
      target_no_show_pct,
      target_occupancy_pct,
      target_return_pct,
      return_window_days,
      working_hours_start,
      working_hours_end
    `
    )
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return {
    targetConfirmationPct: Number(goalsRow?.target_confirmation_pct ?? defaults.targetConfirmationPct),
    targetAttendancePct: Number(goalsRow?.target_attendance_pct ?? defaults.targetAttendancePct),
    targetNoShowPct: Number(goalsRow?.target_no_show_pct ?? defaults.targetNoShowPct),
    targetOccupancyPct: Number(goalsRow?.target_occupancy_pct ?? defaults.targetOccupancyPct),
    targetReturnPct: Number(goalsRow?.target_return_pct ?? defaults.targetReturnPct),
    returnWindowDays: Number(goalsRow?.return_window_days ?? defaults.returnWindowDays),
    workingHoursStart: Number(goalsRow?.working_hours_start ?? defaults.workingHoursStart),
    workingHoursEnd: Number(goalsRow?.working_hours_end ?? defaults.workingHoursEnd),
  };
}

function getPeriodDates(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (period === "7d") start.setDate(start.getDate() - 7);
  else if (period === "30d") start.setDate(start.getDate() - 30);
  else start.setDate(start.getDate() - 90);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parseWeekRange(weekStartISO: string): { start: Date; end: Date } {
  const start = new Date(weekStartISO);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Visão Geral: KPIs do período */
export async function getVisaoGeralData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const goalsConfig = await getClinicGoalsConfig(supabase, clinicId);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at, doctor_id, patient_id, valor, created_by, service_id, appointment_type_id")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startStr)
    .lte("scheduled_at", endStr);

  const total = appointments?.length ?? 0;
  const realizadas = appointments?.filter((a) => a.status === "realizada").length ?? 0;
  const canceladas = appointments?.filter((a) => a.status === "cancelada").length ?? 0;
  const faltas = appointments?.filter((a) => a.status === "falta").length ?? 0;
  const comparecimento = total - canceladas > 0 ? Math.round(((realizadas + faltas) / (total - canceladas)) * 100) : 0;
  const taxaNoShow = total > 0 ? Math.round((faltas / total) * 100) : 0;
  const ticketMedioRealizadas = (() => {
    const realizadasComValor = (appointments ?? []).filter(
      (a) => a.status === "realizada" && Number(a.valor ?? 0) > 0
    );
    if (realizadasComValor.length === 0) return 0;
    const totalValor = realizadasComValor.reduce((acc, a) => acc + Number(a.valor ?? 0), 0);
    return Number((totalValor / realizadasComValor.length).toFixed(2));
  })();
  const receitaPerdidaEstimada = (() => {
    const perdas = (appointments ?? []).filter((a) => a.status === "falta" || a.status === "cancelada");
    const perdaComValor = perdas.reduce((acc, a) => acc + Math.max(0, Number(a.valor ?? 0)), 0);
    const semValor = perdas.filter((a) => Number(a.valor ?? 0) <= 0).length;
    const estimada = perdaComValor + semValor * ticketMedioRealizadas;
    return Number(estimada.toFixed(2));
  })();
  const confirmadas = (appointments ?? []).filter(
    (a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta"
  ).length;

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (period === "7d" ? 7 : period === "30d" ? 30 : 90));
  const { count: prevTotal } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", prevStart.toISOString())
    .lte("scheduled_at", prevEnd.toISOString());
  const crescimento =
    (prevTotal ?? 0) > 0
      ? Math.round(((total - (prevTotal ?? 0)) / (prevTotal ?? 0)) * 100)
      : total > 0
        ? 100
        : 0;

  const byDay: Record<string, { total: number; realizadas: number; canceladas: number; faltas: number }> = {};
  appointments?.forEach((a) => {
    const day = a.scheduled_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, realizadas: 0, canceladas: 0, faltas: 0 };
    byDay[day].total++;
    if (a.status === "realizada") byDay[day].realizadas++;
    if (a.status === "cancelada") byDay[day].canceladas++;
    if (a.status === "falta") byDay[day].faltas++;
  });
  const chartData: VisaoGeralChartPoint[] = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, v]) => ({
      dateKey,
      date: new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      total: v.total,
      realizadas: v.realizadas,
      canceladas: v.canceladas,
      faltas: v.faltas,
    }));

  const hourBuckets: Record<number, number> = {};
  for (let h = goalsConfig.workingHoursStart; h <= goalsConfig.workingHoursEnd; h++) hourBuckets[h] = 0;
  appointments?.forEach((a) => {
    const hour = new Date(a.scheduled_at).getHours();
    if (hour in hourBuckets) hourBuckets[hour] += 1;
  });
  const horariosOciosos: HorarioOcioso[] = Object.entries(hourBuckets)
    .map(([hour, count]) => ({
      hour: `${String(hour).padStart(2, "0")}h`,
      appointments: count,
      recommendation:
        count === 0
          ? "Sem agendamentos nesse horário: abrir encaixe e disparar lista de espera."
          : "Baixa ocupação: priorizar reativação de pacientes para este horário.",
    }))
    .sort((a, b) => a.appointments - b.appointments)
    .slice(0, 3);

  const realizedAppointments = (appointments ?? []).filter((a) => a.status === "realizada" && a.patient_id);
  const retornoWindowEnd = new Date(end);
  retornoWindowEnd.setDate(retornoWindowEnd.getDate() + goalsConfig.returnWindowDays);
  const patientIds = Array.from(new Set(realizedAppointments.map((a) => a.patient_id).filter(Boolean))) as string[];

  const { data: returnAppointments } =
    patientIds.length > 0
      ? await supabase
          .from("appointments")
          .select("id, patient_id, scheduled_at")
          .eq("clinic_id", clinicId)
          .in("patient_id", patientIds)
          .gte("scheduled_at", startStr)
          .lte("scheduled_at", retornoWindowEnd.toISOString())
      : { data: [] as Array<{ id: string; patient_id: string; scheduled_at: string }> };

  const returnsByPatient = new Map<string, string[]>();
  for (const item of returnAppointments ?? []) {
    const list = returnsByPatient.get(item.patient_id) ?? [];
    list.push(item.scheduled_at);
    returnsByPatient.set(item.patient_id, list);
  }

  let retornoAgendado = 0;
  for (const appt of realizedAppointments) {
    const future = returnsByPatient.get(appt.patient_id as string) ?? [];
    const baseTime = new Date(appt.scheduled_at).getTime();
    const hasReturn = future.some((dt) => {
      const t = new Date(dt).getTime();
      const diffDays = (t - baseTime) / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= goalsConfig.returnWindowDays;
    });
    if (hasReturn) retornoAgendado++;
  }

  const taxaConfirmacao = pct(confirmadas, total);
  const taxaComparecimentoFunil = pct(realizadas, confirmadas || total);
  const taxaRetorno = pct(retornoAgendado, realizadas);

  const now = new Date();
  const start7 = new Date(now);
  start7.setDate(start7.getDate() - 7);
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 30);
  const { data: benchmarkAppointments } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start30.toISOString())
    .lte("scheduled_at", now.toISOString());

  const last7 = (benchmarkAppointments ?? []).filter((a) => new Date(a.scheduled_at) >= start7);
  const last30 = benchmarkAppointments ?? [];
  const noShow30d = pct(last30.filter((a) => a.status === "falta").length, last30.length);
  const conf30d = pct(
    last30.filter((a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta").length,
    last30.length
  );
  const comp30d = pct(last30.filter((a) => a.status === "realizada").length, Math.max(1, last30.length));

  const goals = {
    confirmacao: goalsConfig.targetConfirmationPct,
    comparecimento: goalsConfig.targetAttendancePct,
    noShow: goalsConfig.targetNoShowPct,
    ocupacao: goalsConfig.targetOccupancyPct,
    retorno: goalsConfig.targetReturnPct,
  };
  const metas: GoalCard[] = [
    {
      key: "confirmacao",
      label: "Confirmação",
      current: taxaConfirmacao,
      target: goals.confirmacao,
      status: calcGoalStatus(taxaConfirmacao, goals.confirmacao, true),
      trendVs30d: taxaConfirmacao - conf30d,
    },
    {
      key: "comparecimento",
      label: "Comparecimento",
      current: taxaComparecimentoFunil,
      target: goals.comparecimento,
      status: calcGoalStatus(taxaComparecimentoFunil, goals.comparecimento, true),
      trendVs30d: taxaComparecimentoFunil - comp30d,
    },
    {
      key: "noShow",
      label: "No-show",
      current: taxaNoShow,
      target: goals.noShow,
      status: calcGoalStatus(taxaNoShow, goals.noShow, false),
      trendVs30d: taxaNoShow - noShow30d,
    },
    {
      key: "ocupacao",
      label: "Ocupação",
      current: taxaComparecimentoFunil,
      target: goals.ocupacao,
      status: calcGoalStatus(taxaComparecimentoFunil, goals.ocupacao, true),
      trendVs30d: taxaComparecimentoFunil - comp30d,
    },
    {
      key: "retorno",
      label: "Retorno",
      current: taxaRetorno,
      target: goals.retorno,
      status: calcGoalStatus(taxaRetorno, goals.retorno, true),
      trendVs30d: 0,
    },
  ];

  const nowRisk = new Date();
  const historyStart = new Date(nowRisk);
  historyStart.setDate(historyStart.getDate() - 180);
  const upcomingEnd = new Date(nowRisk);
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);

  const { data: patientAppointments } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at, patient_id, patient:patients(full_name, phone)")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", historyStart.toISOString())
    .lte("scheduled_at", upcomingEnd.toISOString());

  const patientStats: Record<
    string,
    { full_name: string; phone: string | null; total: number; faltas: number; canceladas: number; realizadas: number }
  > = {};
  const pacientesRiscoNoShow: PacienteRiscoNoShow[] = [];

  (patientAppointments ?? []).forEach((a) => {
    if (!a.patient_id) return;
    const patient = getSinglePatientRelation(a.patient);
    if (!patientStats[a.patient_id]) {
      patientStats[a.patient_id] = {
        full_name: patient?.full_name ?? "Paciente",
        phone: patient?.phone ?? null,
        total: 0,
        faltas: 0,
        canceladas: 0,
        realizadas: 0,
      };
    }
    const stats = patientStats[a.patient_id];
    stats.total++;
    if (a.status === "falta") stats.faltas++;
    if (a.status === "cancelada") stats.canceladas++;
    if (a.status === "realizada") stats.realizadas++;
  });

  (patientAppointments ?? [])
    .filter(
      (a) =>
        new Date(a.scheduled_at) > nowRisk &&
        new Date(a.scheduled_at) <= upcomingEnd &&
        (a.status === "agendada" || a.status === "confirmada")
    )
    .forEach((a) => {
      if (!a.patient_id) return;
      const stats = patientStats[a.patient_id];
      if (!stats) return;
      const taxaProblema = stats.total > 0 ? (stats.faltas + stats.canceladas) / stats.total : 0;
      let score = 0;
      if (stats.faltas >= 2) score += 40;
      if (stats.canceladas >= 2) score += 20;
      if (stats.total >= 3 && taxaProblema >= 0.4) score += 30;
      if (stats.realizadas === 0 && stats.total >= 2) score += 10;
      const riskScore = Math.min(100, score);
      if (riskScore < 40) return;
      pacientesRiscoNoShow.push({
        patientId: a.patient_id,
        full_name: stats.full_name,
        phone: stats.phone,
        scheduled_at: a.scheduled_at,
        riskScore,
        riskLabel: riskScore >= 70 ? "alto" : "medio",
      });
    });

  const topPacientesRisco = pacientesRiscoNoShow
    .sort((a, b) => b.riskScore - a.riskScore || a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 20);

  return {
    data: {
      total,
      realizadas,
      canceladas,
      faltas,
      taxaComparecimento: comparecimento,
      taxaNoShow,
      crescimento,
      ticketMedioRealizadas,
      receitaPerdidaEstimada,
      pacientesRiscoNoShow: topPacientesRisco,
      horariosOciosos,
      metas,
      chartData,
    } satisfies VisaoGeralData,
    error: null,
  };
}

/** Agenda semanal + procedimentos para o painel da Visão Geral */
export async function getVisaoGeralWeekData(weekStartISO: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { data: null, error: "Não autorizado." };
  }

  const clinicId = profile.clinic_id;
  const { start, end } = parseWeekRange(weekStartISO);
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const [{ data: proceduresRows }, { data: appointmentsRows }] = await Promise.all([
    supabase
      .from("procedures")
      .select("id, name, duration_minutes, display_order")
      .eq("clinic_id", clinicId)
      .order("display_order", { ascending: true }),
    supabase
      .from("appointments")
      .select(
        `
        id,
        scheduled_at,
        status,
        doctor_id,
        procedure_id,
        patient:patients ( full_name ),
        doctor:profiles ( full_name ),
        appointment_procedures ( procedure_id )
      `
      )
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", startStr)
      .lte("scheduled_at", endStr)
      .not("status", "eq", "cancelada")
      .order("scheduled_at", { ascending: true }),
  ]);

  const procedureCountMap = new Map<string, number>();
  const appointments: VisaoGeralWeekAppointment[] = (appointmentsRows ?? []).map((row) => {
    const patient = getSinglePatientRelation(
      row.patient as { full_name: string | null } | { full_name: string | null }[] | null
    );
    const doctor = getSinglePatientRelation(
      row.doctor as { full_name: string | null } | { full_name: string | null }[] | null
    );
    const linkedProcs = (row.appointment_procedures as { procedure_id: string }[] | null) ?? [];
    const procedureIds = new Set<string>();
    if (row.procedure_id) procedureIds.add(row.procedure_id);
    linkedProcs.forEach((p) => procedureIds.add(p.procedure_id));
    const ids = Array.from(procedureIds);
    ids.forEach((id) => procedureCountMap.set(id, (procedureCountMap.get(id) ?? 0) + 1));

    return {
      id: row.id,
      scheduled_at: row.scheduled_at,
      status: row.status,
      patientName: patient?.full_name ?? "Paciente",
      doctorName: doctor?.full_name ?? "Profissional",
      procedureIds: ids,
    };
  });

  const procedures: VisaoGeralWeekProcedure[] = (proceduresRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    duration_minutes: p.duration_minutes ?? 30,
    weekCount: procedureCountMap.get(p.id) ?? 0,
  }));

  return {
    data: {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      procedures,
      appointments,
    } satisfies VisaoGeralWeekData,
    error: null,
  };
}
