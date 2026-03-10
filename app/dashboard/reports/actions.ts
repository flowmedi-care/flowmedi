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

type ResumoExecutivoItem = {
  titulo: string;
  impacto: string;
  acao: string;
  tone: "positive" | "warning" | "neutral";
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

type AlertItem = {
  title: string;
  context: string;
  action: string;
  severity: GoalStatusLevel;
};

type FunnelBreakdownRow = {
  id: string;
  label: string;
  agendadas: number;
  confirmadas: number;
  compareceram: number;
  noShow: number;
  retornoAgendado: number;
  taxaConfirmacao: number;
  taxaComparecimento: number;
  taxaRetorno: number;
};

type FunnelData = {
  agendadas: number;
  confirmadas: number;
  compareceram: number;
  noShow: number;
  retornoAgendado: number;
  taxaConfirmacao: number;
  taxaComparecimento: number;
  taxaRetorno: number;
};

type FunnelBenchmark = {
  noShow7d: number;
  noShow30d: number;
  confirmacao7d: number;
  confirmacao30d: number;
  comparecimento7d: number;
  comparecimento30d: number;
  ocupacao7d: number;
  ocupacao30d: number;
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

type BriefingExecutivo = {
  vitorias: string[];
  riscos: string[];
  acoes: string[];
};

type ProfissionalRow = {
  doctorId: string;
  full_name: string;
  total: number;
  realizadas: number;
  canceladas: number;
  faltas: number;
  taxaConfirmacao: number;
  taxaComparecimento: number;
  taxaNoShow: number;
  taxaRetorno: number;
  tempoMedioMin: number | null;
  status: GoalStatusLevel;
  acaoRecomendada: string;
};

type AtendenteRow = {
  userId: string;
  full_name: string;
  agendamentosCriados: number;
  cancelamentos: number;
  confirmadas: number;
  compareceram: number;
  faltas: number;
  taxaConfirmacao: number;
  taxaComparecimento: number;
  taxaNoShow: number;
  status: GoalStatusLevel;
  acaoRecomendada: string;
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

async function getClinicGoalsConfig(supabase: Awaited<ReturnType<typeof createClient>>, clinicId: string): Promise<ReportGoalsConfig> {
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

/** Visão Geral: KPIs do período */
export async function getVisaoGeralData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const goalsConfig = await getClinicGoalsConfig(supabase, clinicId);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at, doctor_id, patient_id, valor, created_by, appointment_type_id")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startStr)
    .lte("scheduled_at", endStr);

  const total = appointments?.length ?? 0;
  const realizadas = appointments?.filter((a) => a.status === "realizada").length ?? 0;
  const canceladas = appointments?.filter((a) => a.status === "cancelada").length ?? 0;
  const faltas = appointments?.filter((a) => a.status === "falta").length ?? 0;
  const agendadaOuConfirmada =
    appointments?.filter((a) => a.status === "agendada" || a.status === "confirmada").length ?? 0;
  const comparecimento = total - canceladas > 0 ? Math.round((realizadas + faltas) / (total - canceladas) * 100) : 0;
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
  const noShow = faltas;
  const confirmadas = (appointments ?? []).filter((a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta").length;

  // Mês anterior para comparação
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
  const crescimento = (prevTotal ?? 0) > 0 ? Math.round(((total - (prevTotal ?? 0)) / (prevTotal ?? 0)) * 100) : total > 0 ? 100 : 0;

  // Por dia (para gráfico)
  const byDay: Record<string, { total: number; realizadas: number; canceladas: number; faltas: number }> = {};
  appointments?.forEach((a) => {
    const day = a.scheduled_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, realizadas: 0, canceladas: 0, faltas: 0 };
    byDay[day].total++;
    if (a.status === "realizada") byDay[day].realizadas++;
    if (a.status === "cancelada") byDay[day].canceladas++;
    if (a.status === "falta") byDay[day].faltas++;
  });
  const chartData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
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

  // Funil: retorno agendado em até N dias (configurável) após consulta realizada.
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
  const returnedRealizedAppointmentIds = new Set<string>();
  for (const appt of realizedAppointments) {
    const future = returnsByPatient.get(appt.patient_id as string) ?? [];
    const baseTime = new Date(appt.scheduled_at).getTime();
    const hasReturn = future.some((dt) => {
      const t = new Date(dt).getTime();
      const diffDays = (t - baseTime) / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= goalsConfig.returnWindowDays;
    });
    if (hasReturn) {
      retornoAgendado++;
      returnedRealizedAppointmentIds.add(appt.id);
    }
  }

  const funilGeral: FunnelData = {
    agendadas: total,
    confirmadas,
    compareceram: realizadas,
    noShow,
    retornoAgendado,
    taxaConfirmacao: pct(confirmadas, total),
    taxaComparecimento: pct(realizadas, confirmadas || total),
    taxaRetorno: pct(retornoAgendado, realizadas),
  };

  // Benchmark interno: 7 dias vs 30 dias.
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
  const noShow7d = pct(last7.filter((a) => a.status === "falta").length, last7.length);
  const noShow30d = pct(last30.filter((a) => a.status === "falta").length, last30.length);
  const conf7d = pct(
    last7.filter((a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta").length,
    last7.length
  );
  const conf30d = pct(
    last30.filter((a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta").length,
    last30.length
  );
  const comp7d = pct(last7.filter((a) => a.status === "realizada").length, Math.max(1, last7.length));
  const comp30d = pct(last30.filter((a) => a.status === "realizada").length, Math.max(1, last30.length));
  const benchmark: FunnelBenchmark = {
    noShow7d,
    noShow30d,
    confirmacao7d: conf7d,
    confirmacao30d: conf30d,
    comparecimento7d: comp7d,
    comparecimento30d: comp30d,
    ocupacao7d: comp7d,
    ocupacao30d: comp30d,
  };

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
      current: funilGeral.taxaConfirmacao,
      target: goals.confirmacao,
      status: calcGoalStatus(funilGeral.taxaConfirmacao, goals.confirmacao, true),
      trendVs30d: funilGeral.taxaConfirmacao - benchmark.confirmacao30d,
    },
    {
      key: "comparecimento",
      label: "Comparecimento",
      current: funilGeral.taxaComparecimento,
      target: goals.comparecimento,
      status: calcGoalStatus(funilGeral.taxaComparecimento, goals.comparecimento, true),
      trendVs30d: funilGeral.taxaComparecimento - benchmark.comparecimento30d,
    },
    {
      key: "noShow",
      label: "No-show",
      current: taxaNoShow,
      target: goals.noShow,
      status: calcGoalStatus(taxaNoShow, goals.noShow, false),
      trendVs30d: taxaNoShow - benchmark.noShow30d,
    },
    {
      key: "ocupacao",
      label: "Ocupação",
      current: funilGeral.taxaComparecimento,
      target: goals.ocupacao,
      status: calcGoalStatus(funilGeral.taxaComparecimento, goals.ocupacao, true),
      trendVs30d: funilGeral.taxaComparecimento - benchmark.ocupacao30d,
    },
    {
      key: "retorno",
      label: "Retorno",
      current: funilGeral.taxaRetorno,
      target: goals.retorno,
      status: calcGoalStatus(funilGeral.taxaRetorno, goals.retorno, true),
      trendVs30d: 0,
    },
  ];

  const alertas: AlertItem[] = metas
    .filter((m) => m.status !== "ok")
    .map((m) => ({
      title: `${m.label} fora da meta`,
      context: `${m.current}% no período (meta ${m.target}%).`,
      action:
        m.key === "confirmacao"
          ? "Reforçar lembrete + confirmação ativa nas próximas 24h."
          : m.key === "noShow"
            ? "Priorizar contato manual nos pacientes de maior risco hoje."
            : m.key === "retorno"
              ? "Criar rotina de oferta de retorno ao finalizar atendimento."
              : "Revisar distribuição da agenda e abrir encaixes direcionados.",
      severity: m.status,
    }))
    .slice(0, 6);

  // Quebras por profissional, atendente e tipo de consulta.
  const doctorIds = Array.from(new Set((appointments ?? []).map((a) => a.doctor_id).filter(Boolean))) as string[];
  const secretaryIds = Array.from(new Set((appointments ?? []).map((a) => a.created_by).filter(Boolean))) as string[];
  const typeIds = Array.from(new Set((appointments ?? []).map((a) => a.appointment_type_id).filter(Boolean))) as string[];

  const { data: doctorProfiles } =
    doctorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", doctorIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
  const { data: secretaryProfiles } =
    secretaryIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, role").in("id", secretaryIds)
      : { data: [] as Array<{ id: string; full_name: string | null; role: string }> };
  const { data: appointmentTypes } =
    typeIds.length > 0
      ? await supabase.from("appointment_types").select("id, name").in("id", typeIds)
      : { data: [] as Array<{ id: string; name: string | null }> };

  const doctorNameById = new Map((doctorProfiles ?? []).map((p) => [p.id, p.full_name ?? "Profissional"]));
  const secretaryById = new Map((secretaryProfiles ?? []).map((p) => [p.id, { name: p.full_name ?? "Atendente", role: p.role }]));
  const typeNameById = new Map((appointmentTypes ?? []).map((t) => [t.id, t.name ?? "Tipo não informado"]));

  function buildBreakdown(rows: Array<{ key: string; label: string; status: string; appointmentId: string }>): FunnelBreakdownRow[] {
    const grouped: Record<string, FunnelBreakdownRow> = {};
    for (const row of rows) {
      if (!grouped[row.key]) {
        grouped[row.key] = {
          id: row.key,
          label: row.label,
          agendadas: 0,
          confirmadas: 0,
          compareceram: 0,
          noShow: 0,
          retornoAgendado: 0,
          taxaConfirmacao: 0,
          taxaComparecimento: 0,
          taxaRetorno: 0,
        };
      }
      const g = grouped[row.key];
      g.agendadas++;
      if (row.status === "confirmada" || row.status === "realizada" || row.status === "falta") g.confirmadas++;
      if (row.status === "realizada") {
        g.compareceram++;
        if (returnedRealizedAppointmentIds.has(row.appointmentId)) g.retornoAgendado++;
      }
      if (row.status === "falta") g.noShow++;
    }
    return Object.values(grouped).map((g) => ({
      ...g,
      taxaConfirmacao: pct(g.confirmadas, g.agendadas),
      taxaComparecimento: pct(g.compareceram, g.confirmadas || g.agendadas),
      taxaRetorno: pct(g.retornoAgendado, g.compareceram),
    }));
  }

  const porProfissional = buildBreakdown(
    (appointments ?? []).map((a) => ({
      key: a.doctor_id ?? "sem-profissional",
      label: doctorNameById.get(a.doctor_id ?? "") ?? "Sem profissional",
      status: a.status,
      appointmentId: a.id,
    }))
  );
  const porAtendente = buildBreakdown(
    (appointments ?? []).map((a) => {
      const sec = secretaryById.get(a.created_by ?? "");
      const isAtendenteValido = sec?.role === "secretaria" || sec?.role === "admin";
      return {
        key: a.created_by && isAtendenteValido ? a.created_by : "nao-informado",
        label: isAtendenteValido ? (sec?.name ?? "Não informado") : "Não informado",
        status: a.status,
        appointmentId: a.id,
      };
    })
  );
  const porTipoConsulta = buildBreakdown(
    (appointments ?? []).map((a) => ({
      key: a.appointment_type_id ?? "sem-tipo",
      label: typeNameById.get(a.appointment_type_id ?? "") ?? "Tipo não informado",
      status: a.status,
      appointmentId: a.id,
    }))
  );
  const porOrigem = buildBreakdown(
    (appointments ?? []).map((a) => {
      const sec = secretaryById.get(a.created_by ?? "");
      const origem = sec?.role === "secretaria" ? "Secretaria" : sec?.role === "admin" ? "Admin" : "Não informado";
      return {
        key: origem.toLowerCase(),
        label: origem,
        status: a.status,
        appointmentId: a.id,
      };
    })
  );
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
    if (new Date(a.scheduled_at) <= nowRisk) {
      patientStats[a.patient_id].total += 1;
      if (a.status === "falta") patientStats[a.patient_id].faltas += 1;
      if (a.status === "cancelada") patientStats[a.patient_id].canceladas += 1;
      if (a.status === "realizada") patientStats[a.patient_id].realizadas += 1;
    }
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

  const resumoExecutivo: ResumoExecutivoItem[] = [];
  if (receitaPerdidaEstimada > 0) {
    resumoExecutivo.push({
      titulo: "Perda por faltas/cancelamentos",
      impacto: `Perda estimada de R$ ${receitaPerdidaEstimada.toFixed(2)} no período.`,
      acao: "Acione hoje os pacientes de maior risco com lembrete e confirmação ativa.",
      tone: "warning",
    });
  }
  if (topPacientesRisco.length > 0) {
    resumoExecutivo.push({
      titulo: "Risco de no-show nos próximos 7 dias",
      impacto: `${topPacientesRisco.length} pacientes com risco médio/alto já têm consulta marcada.`,
      acao: "Priorize contato manual (WhatsApp/ligação) pelos 10 primeiros da lista.",
      tone: "warning",
    });
  }
  if (horariosOciosos.length > 0) {
    resumoExecutivo.push({
      titulo: "Janelas com ociosidade",
      impacto: `${horariosOciosos.map((h) => h.hour).join(", ")} têm baixa ocupação no período.`,
      acao: "Abrir encaixes e oferecer remarcação para esses horários hoje.",
      tone: "positive",
    });
  }
  if (alertas.length > 0) {
    resumoExecutivo.push({
      titulo: "Metas fora do alvo",
      impacto: `${alertas.length} alertas ativos na operação.`,
      acao: "Executar as ações recomendadas de maior impacto ainda hoje.",
      tone: "warning",
    });
  }

  const vitorias: string[] = [];
  const riscos: string[] = [];
  const acoes: string[] = [];

  if (metas.filter((m) => m.status === "ok").length >= 3) {
    vitorias.push(`${metas.filter((m) => m.status === "ok").length} metas dentro do alvo no período.`);
  }
  if (benchmark.confirmacao7d >= benchmark.confirmacao30d) {
    vitorias.push(`Confirmação melhorou para ${benchmark.confirmacao7d}% (30d: ${benchmark.confirmacao30d}%).`);
  }
  if (benchmark.noShow7d <= benchmark.noShow30d) {
    vitorias.push(`No-show caiu para ${benchmark.noShow7d}% (30d: ${benchmark.noShow30d}%).`);
  }
  if (funilGeral.taxaRetorno >= goals.retorno) {
    vitorias.push(`Taxa de retorno em ${funilGeral.taxaRetorno}% acima da meta (${goals.retorno}%).`);
  }
  if (topPacientesRisco.length === 0) {
    vitorias.push("Sem pacientes críticos de no-show para os próximos 7 dias.");
  }

  if (alertas.length > 0) {
    riscos.push(...alertas.slice(0, 3).map((a) => `${a.title}: ${a.context}`));
  }
  if (receitaPerdidaEstimada > 0) {
    riscos.push(`Perda estimada de R$ ${receitaPerdidaEstimada.toFixed(2)} por faltas/cancelamentos.`);
  }
  if (topPacientesRisco.length > 0) {
    riscos.push(`${topPacientesRisco.length} pacientes com risco médio/alto de no-show na próxima semana.`);
  }

  acoes.push(
    ...alertas.slice(0, 3).map((a) => a.action),
    ...(topPacientesRisco.length > 0
      ? ["Acionar hoje os 10 pacientes de maior risco com confirmação manual."]
      : []),
    ...(horariosOciosos.length > 0
      ? [`Abrir encaixes e ofertas para os horários ${horariosOciosos.map((h) => h.hour).join(", ")}.`]
      : [])
  );

  const briefingExecutivo: BriefingExecutivo = {
    vitorias: vitorias.slice(0, 3).concat(vitorias.length >= 3 ? [] : ["Operação estável no período analisado."]).slice(0, 3),
    riscos: riscos.slice(0, 3).concat(riscos.length >= 3 ? [] : ["Sem riscos críticos adicionais além dos monitorados."]).slice(0, 3),
    acoes: acoes.slice(0, 3).concat(acoes.length >= 3 ? [] : ["Manter rotina diária de confirmação e acompanhamento de faltas."]).slice(0, 3),
  };

  return {
    data: {
      total,
      realizadas,
      canceladas,
      faltas,
      agendadaOuConfirmada,
      taxaComparecimento: comparecimento,
      taxaNoShow,
      crescimento,
      ticketMedioRealizadas,
      receitaPerdidaEstimada,
      pacientesRiscoNoShow: topPacientesRisco,
      horariosOciosos,
      resumoExecutivo,
      funilGeral,
      metas,
      alertas,
      benchmark,
      goalsConfig,
      briefingExecutivo,
      funilPorProfissional: porProfissional,
      funilPorAtendente: porAtendente,
      funilPorTipoConsulta: porTipoConsulta,
      funilPorOrigem: porOrigem,
      chartData,
    },
    error: null,
  };
}

/** Por Profissional: métricas por médico */
export async function getPorProfissionalData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const goalsConfig = await getClinicGoalsConfig(supabase, clinicId);
  const windowDays = goalsConfig.returnWindowDays;
  const retornoWindowEnd = new Date(end);
  retornoWindowEnd.setDate(retornoWindowEnd.getDate() + windowDays);

  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, doctor_id, duration_minutes, started_at, completed_at, patient_id, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const byDoctor: Record<string, {
    full_name: string;
    total: number;
    confirmadas: number;
    realizadas: number;
    canceladas: number;
    faltas: number;
    tempoMedioMin: number | null;
    totalDurationMin: number;
    countWithDuration: number;
    retornoAgendado: number;
    realizadasAppointments: Array<{ id: string; patient_id: string; scheduled_at: string }>;
  }> = {};

  doctors?.forEach((d) => {
    byDoctor[d.id] = {
      full_name: d.full_name ?? "—",
      total: 0,
      confirmadas: 0,
      realizadas: 0,
      canceladas: 0,
      faltas: 0,
      tempoMedioMin: null,
      totalDurationMin: 0,
      countWithDuration: 0,
      retornoAgendado: 0,
      realizadasAppointments: [],
    };
  });

  const patientIdsForReturns = new Set<string>();
  appointments?.forEach((a) => {
    const doc = byDoctor[a.doctor_id];
    if (!doc) return;
    doc.total++;
    if (a.status === "confirmada" || a.status === "realizada" || a.status === "falta") doc.confirmadas++;
    if (a.status === "realizada") {
      doc.realizadas++;
      if (a.duration_minutes != null) {
        doc.totalDurationMin += a.duration_minutes;
        doc.countWithDuration++;
      }
      if (a.patient_id) {
        doc.realizadasAppointments.push({ id: a.id, patient_id: a.patient_id, scheduled_at: a.scheduled_at });
        patientIdsForReturns.add(a.patient_id);
      }
    }
    if (a.status === "cancelada") doc.canceladas++;
    if (a.status === "falta") doc.faltas++;
  });

  const { data: returnAppointments } =
    patientIdsForReturns.size > 0
      ? await supabase
          .from("appointments")
          .select("patient_id, scheduled_at")
          .eq("clinic_id", clinicId)
          .in("patient_id", Array.from(patientIdsForReturns))
          .gte("scheduled_at", start.toISOString())
          .lte("scheduled_at", retornoWindowEnd.toISOString())
      : { data: [] as Array<{ patient_id: string; scheduled_at: string }> };

  const returnsByPatient = new Map<string, string[]>();
  (returnAppointments ?? []).forEach((r) => {
    const list = returnsByPatient.get(r.patient_id) ?? [];
    list.push(r.scheduled_at);
    returnsByPatient.set(r.patient_id, list);
  });

  Object.values(byDoctor).forEach((d) => {
    d.realizadasAppointments.forEach((appt) => {
      const future = returnsByPatient.get(appt.patient_id) ?? [];
      const base = new Date(appt.scheduled_at).getTime();
      const hasReturn = future.some((dt) => {
        const diffDays = (new Date(dt).getTime() - base) / (1000 * 60 * 60 * 24);
        return diffDays > 0 && diffDays <= windowDays;
      });
      if (hasReturn) d.retornoAgendado++;
    });
  });

  const rows: ProfissionalRow[] = Object.entries(byDoctor).map(([id, d]) => {
    const taxaConfirmacao = pct(d.confirmadas, d.total);
    const taxaComparecimento = pct(d.realizadas, d.confirmadas || d.total);
    const taxaNoShow = pct(d.faltas, d.total);
    const taxaRetorno = pct(d.retornoAgendado, d.realizadas);
    const tempoMedio = d.countWithDuration > 0 ? Math.round(d.totalDurationMin / d.countWithDuration) : null;
    const statusNoShow = calcGoalStatus(taxaNoShow, goalsConfig.targetNoShowPct, false);
    const statusComparecimento = calcGoalStatus(taxaComparecimento, goalsConfig.targetAttendancePct, true);
    const status: GoalStatusLevel =
      statusNoShow === "critical" || statusComparecimento === "critical"
        ? "critical"
        : statusNoShow === "warning" || statusComparecimento === "warning"
          ? "warning"
          : "ok";
    return {
      doctorId: id,
      full_name: d.full_name,
      total: d.total,
      realizadas: d.realizadas,
      canceladas: d.canceladas,
      faltas: d.faltas,
      taxaConfirmacao,
      taxaComparecimento,
      taxaNoShow,
      taxaRetorno,
      tempoMedioMin: tempoMedio,
      status,
      acaoRecomendada:
        status === "critical"
          ? "Revisar carteira de pacientes de alto risco e reforçar confirmação manual."
          : status === "warning"
            ? "Ajustar lembretes e monitorar faltas desta agenda."
            : "Manter rotina atual e replicar práticas de melhor desempenho.",
    };
  });

  const topPerformance = [...rows].sort((a, b) => b.taxaComparecimento - a.taxaComparecimento).slice(0, 3);
  const pontosAtencao = [...rows]
    .filter((r) => r.status !== "ok")
    .sort((a, b) => b.taxaNoShow - a.taxaNoShow)
    .slice(0, 5);

  return {
    data: {
      rows,
      topPerformance,
      pontosAtencao,
      metas: {
        comparecimento: goalsConfig.targetAttendancePct,
        noShow: goalsConfig.targetNoShowPct,
        retorno: goalsConfig.targetReturnPct,
      },
    },
    error: null,
  };
}

/** Por Atendente: agendamentos criados, reagendamentos, cancelamentos (created_by) */
export async function getPorAtendenteData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const goalsConfig = await getClinicGoalsConfig(supabase, clinicId);

  const { data: operators } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("clinic_id", clinicId)
    .in("role", ["secretaria", "admin"])
    .order("full_name");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, created_by, created_at, updated_at, scheduled_at, patient_id")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const byOperator: Record<
    string,
    {
      full_name: string;
      role: string;
      criados: number;
      cancelamentos: number;
      confirmadas: number;
      compareceram: number;
      faltas: number;
    }
  > = {};
  operators?.forEach((s) => {
    byOperator[s.id] = {
      full_name: s.full_name ?? "—",
      role: s.role ?? "nao-informado",
      criados: 0,
      cancelamentos: 0,
      confirmadas: 0,
      compareceram: 0,
      faltas: 0,
    };
  });
  byOperator["nao-informado"] = {
    full_name: "Não informado",
    role: "nao-informado",
    criados: 0,
    cancelamentos: 0,
    confirmadas: 0,
    compareceram: 0,
    faltas: 0,
  };

  appointments?.forEach((a) => {
    const operator = a.created_by ? byOperator[a.created_by] : null;
    const key =
      operator && (operator.role === "secretaria" || operator.role === "admin")
        ? a.created_by!
        : "nao-informado";
    byOperator[key].criados++;
    if (a.status === "cancelada") byOperator[key].cancelamentos++;
    if (a.status === "confirmada" || a.status === "realizada" || a.status === "falta") byOperator[key].confirmadas++;
    if (a.status === "realizada") byOperator[key].compareceram++;
    if (a.status === "falta") byOperator[key].faltas++;
  });

  const rows: AtendenteRow[] = Object.entries(byOperator)
    .filter(([k]) => k !== "nao-informado" || byOperator[k].criados > 0)
    .map(([id, d]) => {
      const taxaConfirmacao = pct(d.confirmadas, d.criados);
      const taxaComparecimento = pct(d.compareceram, d.confirmadas || d.criados);
      const taxaNoShow = pct(d.faltas, d.criados);
      const statusNoShow = calcGoalStatus(taxaNoShow, goalsConfig.targetNoShowPct, false);
      const statusConfirmacao = calcGoalStatus(taxaConfirmacao, goalsConfig.targetConfirmationPct, true);
      const status: GoalStatusLevel =
        statusNoShow === "critical" || statusConfirmacao === "critical"
          ? "critical"
          : statusNoShow === "warning" || statusConfirmacao === "warning"
            ? "warning"
            : "ok";
      return {
        userId: id,
        full_name: d.full_name,
        agendamentosCriados: d.criados,
        cancelamentos: d.cancelamentos,
        confirmadas: d.confirmadas,
        compareceram: d.compareceram,
        faltas: d.faltas,
        taxaConfirmacao,
        taxaComparecimento,
        taxaNoShow,
        status,
        acaoRecomendada:
          status === "critical"
            ? "Fazer mutirão de confirmação das consultas mais próximas."
            : status === "warning"
              ? "Ajustar rotina diária de lembretes e reconfirmação."
              : "Manter padrão e apoiar equipe em horários de pico.",
      };
    });

  const ranking = [...rows].sort((a, b) => b.taxaComparecimento - a.taxaComparecimento);
  const alertas = rows
    .filter((r) => r.status !== "ok")
    .sort((a, b) => b.taxaNoShow - a.taxaNoShow)
    .slice(0, 5);

  return {
    data: {
      rows,
      ranking,
      alertas,
      metas: {
        confirmacao: goalsConfig.targetConfirmationPct,
        noShow: goalsConfig.targetNoShowPct,
      },
    },
    error: null,
  };
}

/** Indicadores operacionais */
export async function getOperacionalData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const goalsConfig = await getClinicGoalsConfig(supabase, clinicId);
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startStr)
    .lte("scheduled_at", endStr);

  const total = appointments?.length ?? 0;
  const realizadas = appointments?.filter((a) => a.status === "realizada").length ?? 0;
  const canceladas = appointments?.filter((a) => a.status === "cancelada").length ?? 0;
  const faltas = appointments?.filter((a) => a.status === "falta").length ?? 0;
  const taxaCancelamento = total > 0 ? Math.round((canceladas / total) * 100) : 0;
  const taxaNoShow = total > 0 ? Math.round((faltas / total) * 100) : 0;

  const { count: pacientesNovos } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  const byHour: Record<number, number> = {};
  const byWeekday: Record<number, number> = {};
  for (let h = goalsConfig.workingHoursStart; h <= goalsConfig.workingHoursEnd; h++) byHour[h] = 0;
  for (let d = 0; d < 7; d++) byWeekday[d] = 0;
  appointments?.forEach((a) => {
    const date = new Date(a.scheduled_at);
    const h = date.getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
    const wd = date.getDay();
    byWeekday[wd] = (byWeekday[wd] ?? 0) + 1;
  });
  const picoHorario =
    Object.entries(byHour).length > 0
      ? Object.entries(byHour).sort(([, a], [, b]) => b - a)[0]
      : null;

  const hourRows = Object.entries(byHour)
    .map(([hour, totalH]) => ({
      hour: `${String(hour).padStart(2, "0")}h`,
      total: totalH,
      status:
        totalH <= 1
          ? ("critical" as GoalStatusLevel)
          : totalH <= 3
            ? ("warning" as GoalStatusLevel)
            : ("ok" as GoalStatusLevel),
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const weekdayLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const weekdayRows = Object.entries(byWeekday).map(([d, totalD]) => ({
    day: weekdayLabel[Number(d)] ?? String(d),
    total: totalD,
  }));

  const ocupacao = pct(realizadas, total);
  const metas = {
    ocupacao: goalsConfig.targetOccupancyPct,
    noShow: goalsConfig.targetNoShowPct,
    cancelamento: 15,
  };

  const gargalos: Array<{ titulo: string; impacto: string; acao: string; status: GoalStatusLevel }> = [];
  if (taxaNoShow > metas.noShow) {
    gargalos.push({
      titulo: "No-show acima da meta",
      impacto: `${taxaNoShow}% no período (meta <= ${metas.noShow}%).`,
      acao: "Priorizar reconfirmação D-1 e D-0 para agenda dos próximos dias.",
      status: "critical",
    });
  }
  if (taxaCancelamento > metas.cancelamento) {
    gargalos.push({
      titulo: "Cancelamentos elevados",
      impacto: `${taxaCancelamento}% de cancelamento no período.`,
      acao: "Ativar lista de espera e ofertas de encaixe imediato.",
      status: "warning",
    });
  }
  if (ocupacao < metas.ocupacao) {
    gargalos.push({
      titulo: "Ocupação abaixo da meta",
      impacto: `${ocupacao}% de ocupação (meta ${metas.ocupacao}%).`,
      acao: "Direcionar reativação para horários com baixa densidade.",
      status: "warning",
    });
  }
  const horariosCriticos = hourRows.filter((h) => h.status !== "ok").slice(0, 3);
  if (horariosCriticos.length > 0) {
    gargalos.push({
      titulo: "Janelas de ociosidade",
      impacto: `Horários críticos: ${horariosCriticos.map((h) => h.hour).join(", ")}.`,
      acao: "Abrir encaixes e antecipar retornos para esses horários.",
      status: "warning",
    });
  }

  return {
    data: {
      totalConsultas: total,
      realizadas,
      taxaCancelamento,
      taxaNoShow,
      taxaOcupacao: ocupacao,
      crescimentoPacientes: pacientesNovos ?? 0,
      picoHorario: picoHorario ? `${String(picoHorario[0]).padStart(2, "0")}h` : null,
      metas,
      gargalos: gargalos.slice(0, 5),
      distribuicaoPorHora: hourRows,
      distribuicaoPorDiaSemana: weekdayRows,
    },
    error: null,
  };
}

/** Financeiro + comunicação: visão gerencial acionável */
export async function getFinanceiroData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, doctor_id, valor, patient_id, service_id, appointment_type_id, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", startIso)
    .lte("scheduled_at", endIso);

  const allAppointments = appointments ?? [];
  const realizadasAppointments = allAppointments.filter((a) => a.status === "realizada");
  const realizadas = realizadasAppointments.length;
  const faltas = allAppointments.filter((a) => a.status === "falta");
  const canceladas = allAppointments.filter((a) => a.status === "cancelada");

  const doctorsIds = Array.from(new Set(allAppointments.map((a) => a.doctor_id).filter(Boolean)));
  const serviceIds = Array.from(new Set(allAppointments.map((a) => a.service_id).filter(Boolean)));
  const typeIds = Array.from(new Set(allAppointments.map((a) => a.appointment_type_id).filter(Boolean)));

  const [{ data: doctors }, { data: services }, { data: appointmentTypes }] = await Promise.all([
    doctorsIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", doctorsIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    serviceIds.length > 0
      ? supabase.from("services").select("id, nome").in("id", serviceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string | null }> }),
    typeIds.length > 0
      ? supabase.from("appointment_types").select("id, name").in("id", typeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);

  const doctorNameById = new Map((doctors ?? []).map((d) => [d.id, d.full_name ?? "Profissional"]));
  const serviceNameById = new Map((services ?? []).map((s) => [s.id, s.nome ?? "Serviço"]));
  const typeNameById = new Map((appointmentTypes ?? []).map((t) => [t.id, t.name ?? "Tipo de consulta"]));

  let receitaTotal = 0;
  const receitaPorProfissionalMap = new Map<string, number>();
  const receitaPorServicoMap = new Map<string, number>();

  for (const appt of realizadasAppointments) {
    const valor = Number(appt.valor ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    receitaTotal += valor;
    if (appt.doctor_id) {
      receitaPorProfissionalMap.set(appt.doctor_id, (receitaPorProfissionalMap.get(appt.doctor_id) ?? 0) + valor);
    }
    const serviceLabel =
      (appt.service_id ? serviceNameById.get(appt.service_id) : null) ??
      (appt.appointment_type_id ? typeNameById.get(appt.appointment_type_id) : null) ??
      "Não informado";
    receitaPorServicoMap.set(serviceLabel, (receitaPorServicoMap.get(serviceLabel) ?? 0) + valor);
  }

  const ticketMedio = receitaTotal > 0 && realizadas > 0 ? receitaTotal / realizadas : 0;
  const receitaPerdidaFaltas = faltas.reduce((acc, a) => acc + Math.max(0, Number(a.valor ?? 0)), 0);
  const receitaPerdidaCancelamentos = canceladas.reduce((acc, a) => acc + Math.max(0, Number(a.valor ?? 0)), 0);
  const faltasSemValor = faltas.filter((a) => Number(a.valor ?? 0) <= 0).length;
  const canceladasSemValor = canceladas.filter((a) => Number(a.valor ?? 0) <= 0).length;
  const receitaPerdidaTotal =
    receitaPerdidaFaltas + receitaPerdidaCancelamentos + (faltasSemValor + canceladasSemValor) * ticketMedio;

  const receitaPorProfissional = Array.from(receitaPorProfissionalMap.entries())
    .map(([doctorId, valor]) => ({
      doctorId,
      doctorName: doctorNameById.get(doctorId) ?? "Profissional",
      valor: Number(valor.toFixed(2)),
    }))
    .sort((a, b) => b.valor - a.valor);

  const receitaPorServico = Array.from(receitaPorServicoMap.entries())
    .map(([servico, valor]) => ({ servico, valor: Number(valor.toFixed(2)) }))
    .sort((a, b) => b.valor - a.valor);

  // Forecast (7 e 30 dias futuros)
  const now = new Date();
  const next7 = new Date(now);
  next7.setDate(next7.getDate() + 7);
  const next30 = new Date(now);
  next30.setDate(next30.getDate() + 30);
  const { data: futureAppointments } = await supabase
    .from("appointments")
    .select("id, status, valor, scheduled_at")
    .eq("clinic_id", clinicId)
    .in("status", ["agendada", "confirmada"])
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", next30.toISOString());

  let previsao7d = 0;
  let previsao30d = 0;
  for (const a of futureAppointments ?? []) {
    const baseValor = Number(a.valor ?? 0) > 0 ? Number(a.valor ?? 0) : ticketMedio;
    if (new Date(a.scheduled_at) <= next7) previsao7d += baseValor;
    previsao30d += baseValor;
  }

  // LTV aproximado: últimos 12 meses
  const ltvStart = new Date(now);
  ltvStart.setDate(ltvStart.getDate() - 365);
  const { data: historicalRevenueRows } = await supabase
    .from("appointments")
    .select("patient_id, valor")
    .eq("clinic_id", clinicId)
    .eq("status", "realizada")
    .gte("scheduled_at", ltvStart.toISOString())
    .lte("scheduled_at", now.toISOString());

  let receitaHistorica = 0;
  const patientsWithRevenue = new Set<string>();
  for (const row of historicalRevenueRows ?? []) {
    const valor = Number(row.valor ?? 0);
    if (valor > 0) {
      receitaHistorica += valor;
      if (row.patient_id) patientsWithRevenue.add(row.patient_id);
    }
  }
  const ltvAproximado = patientsWithRevenue.size > 0 ? receitaHistorica / patientsWithRevenue.size : 0;

  // Comunicação e conversão por mensagem/template
  const { data: messageLogs } = await supabase
    .from("message_log")
    .select("id, channel, type, appointment_id, sent_at")
    .eq("clinic_id", clinicId)
    .gte("sent_at", startIso)
    .lte("sent_at", endIso);

  const mensagens = messageLogs ?? [];
  const totalMensagens = mensagens.length;
  const mensagensWhatsApp = mensagens.filter((m) => m.channel === "whatsapp").length;
  const mensagensEmail = mensagens.filter((m) => m.channel === "email").length;

  const appointmentStatusById = new Map(allAppointments.map((a) => [a.id, a.status]));
  const typeMetrics = new Map<
    string,
    { sent: number; withAppointment: number; confirmadas: number; compareceram: number; noShow: number }
  >();
  const dedupByTypeAndAppointment = new Set<string>();

  for (const log of mensagens) {
    const key = String(log.type ?? "outro");
    if (!typeMetrics.has(key)) {
      typeMetrics.set(key, { sent: 0, withAppointment: 0, confirmadas: 0, compareceram: 0, noShow: 0 });
    }
    const metric = typeMetrics.get(key)!;
    metric.sent++;

    if (log.appointment_id) {
      const dedupKey = `${key}:${log.appointment_id}`;
      if (dedupByTypeAndAppointment.has(dedupKey)) continue;
      dedupByTypeAndAppointment.add(dedupKey);
      metric.withAppointment++;
      const status = appointmentStatusById.get(log.appointment_id);
      if (status === "confirmada" || status === "realizada" || status === "falta") metric.confirmadas++;
      if (status === "realizada") metric.compareceram++;
      if (status === "falta") metric.noShow++;
    }
  }

  const conversaoPorTemplate = Array.from(typeMetrics.entries())
    .map(([type, m]) => {
      const taxaConfirmacao = pct(m.confirmadas, m.withAppointment);
      const taxaComparecimento = pct(m.compareceram, m.withAppointment);
      const impactoReceitaEstimada = Number((m.compareceram * ticketMedio).toFixed(2));
      const roiIndice = m.sent > 0 ? Number((impactoReceitaEstimada / m.sent).toFixed(2)) : 0;
      return {
        type,
        enviados: m.sent,
        vinculadosConsulta: m.withAppointment,
        taxaConfirmacao,
        taxaComparecimento,
        noShow: m.noShow,
        impactoReceitaEstimada,
        roiIndice,
      };
    })
    .sort((a, b) => b.impactoReceitaEstimada - a.impactoReceitaEstimada)
    .slice(0, 12);

  const post24hMonthStart = new Date(now);
  post24hMonthStart.setUTCDate(1);
  post24hMonthStart.setUTCHours(0, 0, 0, 0);
  const { count: whatsappPost24hStarts } = await supabase
    .from("whatsapp_post24h_usage")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", post24hMonthStart.toISOString())
    .lte("created_at", now.toISOString());

  return {
    data: {
      receitaTotal: Number(receitaTotal.toFixed(2)),
      receitaPerdidaTotal: Number(receitaPerdidaTotal.toFixed(2)),
      receitaPerdidaFaltas: Number((receitaPerdidaFaltas + faltasSemValor * ticketMedio).toFixed(2)),
      receitaPerdidaCancelamentos: Number((receitaPerdidaCancelamentos + canceladasSemValor * ticketMedio).toFixed(2)),
      receitaPorProfissional,
      receitaPorServico,
      ticketMedio: Number(ticketMedio.toFixed(2)),
      ltvAproximado: Number(ltvAproximado.toFixed(2)),
      previsaoReceita7d: Number(previsao7d.toFixed(2)),
      previsaoReceita30d: Number(previsao30d.toFixed(2)),
      consultasRealizadas: realizadas,
      mensagensResumo: {
        totalMensagens,
        mensagensWhatsApp,
        mensagensEmail,
        whatsappPost24hStartsMesAtual: whatsappPost24hStarts ?? 0,
      },
      conversaoPorTemplate,
      mensagem:
        receitaTotal > 0
          ? "Financeiro consolidado com receita, perdas, previsão e impacto de comunicação."
          : "Ainda não há receitas registradas no período, mas os blocos de previsão e comunicação já estão ativos.",
    },
    error: null,
  };
}

/** Auditoria: listagem com filtros */
export async function getAuditLog(
  clinicId: string,
  opts: { userId?: string; from?: string; to?: string; limit?: number } = {}
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  let q = supabase
    .from("audit_log")
    .select(
      `
      id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      created_at,
      profiles!user_id ( id, full_name )
    `
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to) q = q.lte("created_at", opts.to);

  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
