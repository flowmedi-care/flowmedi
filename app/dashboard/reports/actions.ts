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
  const defaultGoals = getDefaultReportGoals();
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
  const goalsConfig: ReportGoalsConfig = {
    targetConfirmationPct: Number(goalsRow?.target_confirmation_pct ?? defaultGoals.targetConfirmationPct),
    targetAttendancePct: Number(goalsRow?.target_attendance_pct ?? defaultGoals.targetAttendancePct),
    targetNoShowPct: Number(goalsRow?.target_no_show_pct ?? defaultGoals.targetNoShowPct),
    targetOccupancyPct: Number(goalsRow?.target_occupancy_pct ?? defaultGoals.targetOccupancyPct),
    targetReturnPct: Number(goalsRow?.target_return_pct ?? defaultGoals.targetReturnPct),
    returnWindowDays: Number(goalsRow?.return_window_days ?? defaultGoals.returnWindowDays),
    workingHoursStart: Number(goalsRow?.working_hours_start ?? defaultGoals.workingHoursStart),
    workingHoursEnd: Number(goalsRow?.working_hours_end ?? defaultGoals.workingHoursEnd),
  };

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

  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, doctor_id, duration_minutes, started_at, completed_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const byDoctor: Record<
    string,
    {
      full_name: string;
      total: number;
      realizadas: number;
      canceladas: number;
      faltas: number;
      taxaComparecimento: number;
      tempoMedioMin: number | null;
      totalDurationMin: number;
      countWithDuration: number;
    }
  > = {};

  doctors?.forEach((d) => {
    byDoctor[d.id] = {
      full_name: d.full_name ?? "—",
      total: 0,
      realizadas: 0,
      canceladas: 0,
      faltas: 0,
      taxaComparecimento: 0,
      tempoMedioMin: null,
      totalDurationMin: 0,
      countWithDuration: 0,
    };
  });

  appointments?.forEach((a) => {
    const doc = byDoctor[a.doctor_id];
    if (!doc) return;
    doc.total++;
    if (a.status === "realizada") {
      doc.realizadas++;
      if (a.duration_minutes != null) {
        doc.totalDurationMin += a.duration_minutes;
        doc.countWithDuration++;
      }
    }
    if (a.status === "cancelada") doc.canceladas++;
    if (a.status === "falta") doc.faltas++;
  });

  const list = Object.entries(byDoctor).map(([id, d]) => {
    const totalMenosCancel = d.total - d.canceladas;
    const taxa = totalMenosCancel > 0 ? Math.round(((d.realizadas + d.faltas) / totalMenosCancel) * 100) : 0;
    const tempoMedio =
      d.countWithDuration > 0 ? Math.round(d.totalDurationMin / d.countWithDuration) : null;
    return {
      doctorId: id,
      full_name: d.full_name,
      total: d.total,
      realizadas: d.realizadas,
      canceladas: d.canceladas,
      faltas: d.faltas,
      taxaComparecimento: taxa,
      tempoMedioMin: tempoMedio,
    };
  });

  return { data: list, error: null };
}

/** Por Atendente: agendamentos criados, reagendamentos, cancelamentos (created_by) */
export async function getPorAtendenteData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);

  const { data: operators } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("clinic_id", clinicId)
    .in("role", ["secretaria", "admin"])
    .order("full_name");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, created_by, created_at, updated_at, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const byOperator: Record<
    string,
    { full_name: string; role: string; criados: number; alterados: number; cancelamentos: number }
  > = {};
  operators?.forEach((s) => {
    byOperator[s.id] = {
      full_name: s.full_name ?? "—",
      role: s.role ?? "nao-informado",
      criados: 0,
      alterados: 0,
      cancelamentos: 0,
    };
  });
  byOperator["nao-informado"] = {
    full_name: "Não informado",
    role: "nao-informado",
    criados: 0,
    alterados: 0,
    cancelamentos: 0,
  };

  appointments?.forEach((a) => {
    const operator = a.created_by ? byOperator[a.created_by] : null;
    const key =
      operator && (operator.role === "secretaria" || operator.role === "admin")
        ? a.created_by!
        : "nao-informado";
    byOperator[key].criados++;
    if (a.status === "cancelada") byOperator[key].cancelamentos++;
  });

  const list = Object.entries(byOperator)
    .filter(([k]) => k !== "nao-informado" || byOperator[k].criados > 0)
    .map(([id, d]) => ({
      userId: id,
      full_name: d.full_name,
      agendamentosCriados: d.criados,
      cancelamentos: d.cancelamentos,
    }));

  return { data: list, error: null };
}

/** Indicadores operacionais */
export async function getOperacionalData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
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
  appointments?.forEach((a) => {
    const h = new Date(a.scheduled_at).getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
  });
  const picoHorario =
    Object.entries(byHour).length > 0
      ? Object.entries(byHour).sort(([, a], [, b]) => b - a)[0]
      : null;

  return {
    data: {
      totalConsultas: total,
      realizadas,
      taxaCancelamento,
      taxaNoShow,
      crescimentoPacientes: pacientesNovos ?? 0,
      picoHorario: picoHorario ? `${String(picoHorario[0]).padStart(2, "0")}h` : null,
    },
    error: null,
  };
}

/** Financeiro: placeholder até ter modelo de receita */
export async function getFinanceiroData(clinicId: string, period: Period = "30d") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { start, end } = getPeriodDates(period);
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, doctor_id, valor")
    .eq("clinic_id", clinicId)
    .eq("status", "realizada")
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const realizadas = appointments?.length ?? 0;
  const doctorsIds = Array.from(new Set((appointments ?? []).map((a) => a.doctor_id).filter(Boolean)));
  const { data: doctors } =
    doctorsIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorsIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };

  const doctorNameById = new Map((doctors ?? []).map((d) => [d.id, d.full_name ?? "Profissional"]));
  const receitaPorProfissionalMap = new Map<string, number>();
  let receitaTotal = 0;

  for (const appt of appointments ?? []) {
    const valor = Number(appt.valor ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    receitaTotal += valor;
    if (appt.doctor_id) {
      receitaPorProfissionalMap.set(
        appt.doctor_id,
        (receitaPorProfissionalMap.get(appt.doctor_id) ?? 0) + valor
      );
    }
  }

  const receitaPorProfissional = Array.from(receitaPorProfissionalMap.entries())
    .map(([doctorId, valor]) => ({
      doctorId,
      doctorName: doctorNameById.get(doctorId) ?? "Profissional",
      valor: Number(valor.toFixed(2)),
    }))
    .sort((a, b) => b.valor - a.valor);

  const ticketMedio = receitaTotal > 0 && realizadas > 0 ? receitaTotal / realizadas : 0;

  return {
    data: {
      receitaTotal: Number(receitaTotal.toFixed(2)),
      receitaPorProfissional,
      ticketMedio: Number(ticketMedio.toFixed(2)),
      mensagem:
        receitaTotal > 0
          ? "Receita calculada a partir do campo de valor das consultas realizadas no período."
          : "Ainda não há valores registrados em consultas realizadas neste período.",
      consultasRealizadas: realizadas,
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
