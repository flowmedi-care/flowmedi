"use server";

import { createClient } from "@/lib/supabase/server";

export type Period = "7d" | "30d" | "90d";

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
    .select("id, status, scheduled_at, doctor_id")
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

  return {
    data: {
      total,
      realizadas,
      canceladas,
      faltas,
      agendadaOuConfirmada,
      taxaComparecimento: comparecimento,
      crescimento,
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
    .select("id, status, doctor_id")
    .eq("clinic_id", clinicId)
    .eq("status", "realizada")
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const realizadas = appointments?.length ?? 0;
  return {
    data: {
      receitaTotal: 0,
      receitaPorProfissional: [] as { doctorId: string; valor: number }[],
      ticketMedio: 0,
      mensagem: "Configure valores nas consultas para ver receita e ticket médio.",
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
