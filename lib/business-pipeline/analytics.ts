"use server";

import { createClient } from "@/lib/supabase/server";
import { getMonthPeriod, todayDateOnly } from "@/lib/financeiro/date-utils";
import {
  isComandaCompetenceEligible,
  comandaCompetenceDate,
} from "@/lib/financeiro/comanda-rules";
import { canForecastAppointment, isActiveScheduleStatus } from "./eligibility";
import {
  buildAssumptions,
  buildConfidence,
  expectedFromAgendado,
  resolveNoShowProbability,
  type NoShowBucket,
} from "./forecasting";
import { buildConversions, buildPipelineHealth, stageAmount } from "./health";
import { computeForecastAccuracy } from "./accuracy";
import type { ForecastResult, PerformanceMetrics } from "./types";

async function getClinicId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, clinicId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", supabase, clinicId: null };
  }
  return { error: null, supabase, clinicId: profile.clinic_id as string };
}

async function loadNoShowMaps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string
) {
  const start = new Date();
  start.setDate(start.getDate() - 90);

  const { data: appts } = await supabase
    .from("appointments")
    .select("status, service_id, doctor_id")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .in("status", ["realizada", "falta", "cancelada"]);

  const byService = new Map<string, NoShowBucket>();
  const byDoctor = new Map<string, NoShowBucket>();
  let clinicFaltas = 0;
  let clinicTotal = 0;

  for (const a of appts ?? []) {
    if (a.status === "cancelada") continue;
    clinicTotal++;
    if (a.status === "falta") clinicFaltas++;

    const sid = a.service_id as string | null;
    if (sid) {
      const cur = byService.get(sid) ?? { key: sid, faltas: 0, total: 0 };
      cur.total++;
      if (a.status === "falta") cur.faltas++;
      byService.set(sid, cur);
    }
    const did = a.doctor_id as string | null;
    if (did) {
      const cur = byDoctor.get(did) ?? { key: did, faltas: 0, total: 0 };
      cur.total++;
      if (a.status === "falta") cur.faltas++;
      byDoctor.set(did, cur);
    }
  }

  const clinicRate = clinicTotal > 0 ? clinicFaltas / clinicTotal : 0;
  return { byService, byDoctor, clinicRate, clinicTotal };
}

/**
 * Snapshot do pipeline para a lente Competência (Agendado → Previsto → Faturado)
 * e valores de caixa do período (Recebido) para health completo.
 */
export async function getCompetencePipelineForecast(
  months = 1
): Promise<{ error: string | null; data: ForecastResult | null }> {
  const ctx = await getClinicId();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: null };

  const { supabase, clinicId } = ctx;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { startIso, endIso } = getMonthPeriod(year, month);

  // Expand window for "agendado" forward-looking in current month + remaining days
  const today = todayDateOnly();

  const [{ data: appointments }, { data: comandas }, { data: payments }, noShow] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, status, scheduled_at, valor, service_id, doctor_id, payment_policy")
        .eq("clinic_id", clinicId)
        .gte("scheduled_at", startIso)
        .lte("scheduled_at", endIso),
      supabase
        .from("comandas")
        .select("id, total_amount, paid_amount, status, closed_at, created_at, issued_at")
        .eq("clinic_id", clinicId)
        .neq("status", "cancelada"),
      supabase
        .from("patient_payments")
        .select("amount, gross_amount, paid_at, plan_prepaid, refunded_at, payment_method")
        .eq("clinic_id", clinicId)
        .gte("paid_at", startIso)
        .lte("paid_at", endIso)
        .is("refunded_at", null),
      loadNoShowMaps(supabase, clinicId),
    ]);

  let agendado = 0;
  let previstoWeighted = 0;
  let sourceVotes: Record<string, number> = { service: 0, doctor: 0, clinic: 0 };
  let sampleAcc = 0;
  let fallbackCount = 0;
  let nItems = 0;

  const serviceNoShowLoss: Record<string, { name: string; loss: number }> = {};

  for (const a of appointments ?? []) {
    if (!canForecastAppointment(a as { status: string; scheduled_at: string | null; valor: number | null })) {
      continue;
    }
    if (!isActiveScheduleStatus(String(a.status)) && a.status !== "realizada") continue;

    const valor = Number(a.valor ?? 0);
    if (valor <= 0 && isActiveScheduleStatus(String(a.status))) {
      // still count? skip zero
    }
    if (valor <= 0) continue;

    // For competência month: include all appointments in month that aren't cancel/falta
    if (a.status === "falta" || a.status === "cancelada") continue;

    agendado += valor;
    const resolved = resolveNoShowProbability({
      serviceId: (a.service_id as string) ?? null,
      doctorId: (a.doctor_id as string) ?? null,
      byService: noShow.byService,
      byDoctor: noShow.byDoctor,
      clinicRate: noShow.clinicRate,
    });
    const expected = expectedFromAgendado(valor, resolved.rate);
    previstoWeighted += expected;
    sourceVotes[resolved.source]++;
    sampleAcc += resolved.sampleSize;
    if (resolved.fallback) fallbackCount++;
    nItems++;

    const loss = valor - expected;
    if (loss > 0 && a.service_id) {
      const sid = String(a.service_id);
      if (!serviceNoShowLoss[sid]) serviceNoShowLoss[sid] = { name: sid, loss: 0 };
      serviceNoShowLoss[sid].loss += loss;
    }
  }

  let faturado = 0;
  for (const c of comandas ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    const ref = comandaCompetenceDate(c);
    if (ref >= startIso && ref <= endIso) faturado += Number(c.total_amount);
  }

  const recebido = (payments ?? []).reduce((s, p) => {
    if (p.plan_prepaid || p.payment_method === "credito_interno") return s;
    return s + Number(p.gross_amount ?? p.amount);
  }, 0);

  const previsto = previstoWeighted;
  const dominantSource =
    (Object.entries(sourceVotes).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | "service"
      | "doctor"
      | "clinic") ?? "clinic";

  const reasoning = {
    probabilitySource: dominantSource,
    sampleSize: noShow.clinicTotal || Math.round(sampleAcc / Math.max(nItems, 1)),
    fallback: fallbackCount > nItems / 2 || dominantSource === "clinic",
  };

  const topNoShowCause = Object.values(serviceNoShowLoss).sort((a, b) => b.loss - a.loss)[0];

  // Unbilled after clinical: encounters awaiting
  const { count: awaitingCount } = await supabase
    .from("encounters")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "finalizado_aguardando_cobranca");

  const { count: overdueAr } = await supabase
    .from("comandas")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .in("status", ["aberta", "parcial"])
    .not("issued_at", "is", null);

  const health = buildPipelineHealth(
    [
      stageAmount("agendado", agendado),
      stageAmount("previsto", previsto),
      stageAmount("faturado", faturado),
      stageAmount("recebido", recebido),
    ],
    {
      "agendado->previsto": topNoShowCause
        ? `No-show / risco de falta (maior impacto: serviço)`
        : "Ajuste de comparecimento",
      "previsto->faturado":
        (awaitingCount ?? 0) > 0
          ? `Consultas encerradas sem emissão (${awaitingCount})`
          : "Gap entre previsto e faturado",
      "faturado->recebido":
        (overdueAr ?? 0) > 0
          ? `Títulos em aberto (${overdueAr})`
          : "Gap entre faturado e recebido",
    }
  );

  const confidence = buildConfidence({
    sampleSize: reasoning.sampleSize,
    source: reasoning.probabilitySource,
    fallback: reasoning.fallback,
  });

  // Historical accuracy: previous month previsto approx vs faturado
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prev = getMonthPeriod(prevYear, prevMonth);
  let prevFaturado = 0;
  for (const c of comandas ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    const ref = comandaCompetenceDate(c);
    if (ref >= prev.startIso && ref <= prev.endIso) prevFaturado += Number(c.total_amount);
  }
  // Approximate prev previsto using clinic no-show on prev appointments valor
  const { data: prevAppts } = await supabase
    .from("appointments")
    .select("status, valor")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", prev.startIso)
    .lte("scheduled_at", prev.endIso)
    .neq("status", "cancelada");

  let prevAgendado = 0;
  for (const a of prevAppts ?? []) {
    if (a.status === "falta") continue;
    prevAgendado += Number(a.valor ?? 0);
  }
  const prevPrevisto = expectedFromAgendado(prevAgendado, noShow.clinicRate);
  const accuracy = computeForecastAccuracy(
    prevPrevisto,
    prevFaturado,
    (prevAppts ?? []).length
  );

  void months;
  void today;

  return {
    error: null,
    data: {
      lens: "competencia",
      agendado,
      previsto,
      faturado,
      recebido,
      confidence,
      accuracy,
      assumptions: buildAssumptions(reasoning),
      reasoning,
      conversions: buildConversions({ agendado, previsto, faturado, recebido }),
      pipelineHealth: health,
      attendanceRatePct: (1 - noShow.clinicRate) * 100,
    },
  };
}

/** Lente caixa / AR: Faturado → Recebido → Saldo + contexto Agendado/Previsto. */
export async function getReceberPipelineSnapshot(): Promise<{
  error: string | null;
  data: ForecastResult | null;
}> {
  const base = await getCompetencePipelineForecast(1);
  if (base.error || !base.data) return base;

  const ctx = await getClinicId();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: null };

  const { data: open } = await ctx.supabase
    .from("comandas")
    .select("total_amount, paid_amount, status, issued_at, appointment:appointments(status)")
    .eq("clinic_id", ctx.clinicId)
    .in("status", ["aberta", "parcial"])
    .not("issued_at", "is", null);

  let saldo = 0;
  for (const c of open ?? []) {
    const appt = Array.isArray(c.appointment) ? c.appointment[0] : c.appointment;
    if ((appt as { status?: string })?.status === "cancelada") continue;
    saldo += Math.max(0, Number(c.total_amount) - Number(c.paid_amount));
  }

  const d = base.data;
  const arHealth = buildPipelineHealth(
    [
      stageAmount("faturado", d.faturado),
      stageAmount("recebido", d.recebido),
    ],
    {
      "faturado->recebido":
        saldo > 0 ? `Títulos em aberto (saldo R$ ${saldo.toFixed(0)})` : "Recebimento em dia",
    }
  );

  return {
    error: null,
    data: {
      ...d,
      lens: "caixa",
      saldo,
      pipelineHealth: arHealth,
    },
  };
}

export async function getPerformanceMetrics(): Promise<{
  error: string | null;
  data: PerformanceMetrics | null;
}> {
  const ctx = await getClinicId();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: null };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const cur = getMonthPeriod(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prev = getMonthPeriod(prevYear, prevMonth);

  const [{ data: comandas }, noShow, { data: payments }] = await Promise.all([
    ctx.supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", ctx.clinicId)
      .neq("status", "cancelada"),
    loadNoShowMaps(ctx.supabase, ctx.clinicId),
    ctx.supabase
      .from("patient_payments")
      .select("paid_at, comanda_id, amount")
      .eq("clinic_id", ctx.clinicId)
      .gte("paid_at", prev.startIso)
      .is("refunded_at", null)
      .limit(500),
  ]);

  let receitaAtual = 0;
  let receitaAnterior = 0;
  for (const c of comandas ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    const ref = comandaCompetenceDate(c);
    if (ref >= cur.startIso && ref <= cur.endIso) receitaAtual += Number(c.total_amount);
    if (ref >= prev.startIso && ref <= prev.endIso) receitaAnterior += Number(c.total_amount);
  }

  const receitaMomPct =
    receitaAnterior > 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

  // Avg days from issued_at to first payment — approximate via joining
  const { data: issued } = await ctx.supabase
    .from("comandas")
    .select("id, issued_at")
    .eq("clinic_id", ctx.clinicId)
    .not("issued_at", "is", null)
    .gte("issued_at", prev.startIso)
    .limit(200);

  const issuedMap = new Map((issued ?? []).map((c) => [c.id as string, c.issued_at as string]));
  let daysSum = 0;
  let daysN = 0;
  for (const p of payments ?? []) {
    const issuedAt = issuedMap.get(p.comanda_id as string);
    if (!issuedAt || !p.paid_at) continue;
    const d =
      (new Date(p.paid_at as string).getTime() - new Date(issuedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (d >= 0 && d < 365) {
      daysSum += d;
      daysN++;
    }
  }

  // Previous no-show for delta: reuse clinic rate as current; prev window approximate same
  const noShowPct = noShow.clinicRate * 100;

  return {
    error: null,
    data: {
      receitaMomPct,
      receitaAtual,
      receitaAnterior,
      noShowPct,
      noShowDeltaPct: 0,
      tempoMedioReceberDias: daysN > 0 ? daysSum / daysN : null,
      sampleSize: noShow.clinicTotal,
    },
  };
}
