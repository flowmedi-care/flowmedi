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

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, scheduled_at, doctor_id, patient_id, valor")
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
  for (let h = 8; h <= 18; h++) hourBuckets[h] = 0;
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

  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setDate(historyStart.getDate() - 180);
  const upcomingEnd = new Date(now);
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
    if (!patientStats[a.patient_id]) {
      patientStats[a.patient_id] = {
        full_name: a.patient?.full_name ?? "Paciente",
        phone: a.patient?.phone ?? null,
        total: 0,
        faltas: 0,
        canceladas: 0,
        realizadas: 0,
      };
    }
    if (new Date(a.scheduled_at) <= now) {
      patientStats[a.patient_id].total += 1;
      if (a.status === "falta") patientStats[a.patient_id].faltas += 1;
      if (a.status === "cancelada") patientStats[a.patient_id].canceladas += 1;
      if (a.status === "realizada") patientStats[a.patient_id].realizadas += 1;
    }
  });

  (patientAppointments ?? [])
    .filter(
      (a) =>
        new Date(a.scheduled_at) > now &&
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

  const { data: secretaries } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "secretaria")
    .order("full_name");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status, created_by, created_at, updated_at, scheduled_at")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const bySecretary: Record<
    string,
    { full_name: string; criados: number; alterados: number; cancelamentos: number }
  > = {};
  secretaries?.forEach((s) => {
    bySecretary[s.id] = { full_name: s.full_name ?? "—", criados: 0, alterados: 0, cancelamentos: 0 };
  });
  bySecretary["_admin"] = { full_name: "Admin", criados: 0, alterados: 0, cancelamentos: 0 };

  appointments?.forEach((a) => {
    const key = a.created_by ?? "_admin";
    if (!bySecretary[key]) bySecretary[key] = { full_name: "Outro", criados: 0, alterados: 0, cancelamentos: 0 };
    bySecretary[key].criados++;
    if (a.status === "cancelada") bySecretary[key].cancelamentos++;
  });

  const list = Object.entries(bySecretary)
    .filter(([k]) => k !== "_admin" || bySecretary[k].criados > 0)
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
