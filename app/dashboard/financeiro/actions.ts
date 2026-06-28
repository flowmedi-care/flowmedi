// FINANCEIRO FASE 1 — server actions do módulo financeiro

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  isComandaCompetenceEligible,
  comandaCompetenceDate,
  isComandaInPeriod,
} from "@/lib/financeiro/comanda-rules";
import {
  getMonthPeriod,
  daysOpenSince,
  todayDateOnly,
  addDaysDateOnly,
  toDateOnly,
} from "@/lib/financeiro/date-utils";
import type {
  DashboardMetrics,
  ExpenseCategory,
  ExpenseGroupKey,
  FinanceAlerts,
  FinancialEntryRow,
  FinancialLens,
  OpenComandaRow,
  PendingExpenseRow,
  RecurrenceInput,
  StockLineInput,
} from "@/lib/financeiro/types";
import { generateRecurrenceDates, addRecurrenceInterval } from "@/lib/financeiro/recurrence";
import { categoryToDreSection } from "@/lib/financeiro/constants";
import { applyStockFromExpense } from "@/lib/estoque/stock-from-expense";

const FINANCE_PATHS = [
  "/dashboard/financeiro",
  "/dashboard/financeiro/receber",
  "/dashboard/financeiro/pagar",
  "/dashboard/financeiro/extrato",
  "/dashboard/financeiro/competencia",
  "/dashboard/financeiro/fluxo-caixa",
  "/dashboard/financeiro/dre",
  "/dashboard",
];

function revalidateFinanceiro() {
  for (const p of FINANCE_PATHS) revalidatePath(p);
}

async function getFinanceProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", supabase, user, profile: null };
  if (profile.role === "medico") return { error: "Sem permissão.", supabase, user, profile: null };

  return { error: null, supabase, user, profile };
}

function canManage(role: string) {
  return role === "admin" || role === "secretaria";
}

function inferLens(row: {
  entry_type: string;
  origin: string;
  status: string;
  paid_at: string | null;
  comanda_id: string | null;
}): FinancialLens {
  if (row.origin === "manual") return "manual";
  if (row.entry_type === "receita" && row.origin === "patient") return "caixa";
  if (row.entry_type === "despesa" && row.status === "pago" && row.paid_at) return "caixa";
  if (row.comanda_id) return "competencia";
  return "manual";
}

function mapSupplierDisplay(
  supplierName: string | null,
  supplier?: { name: string } | { name: string }[] | null
) {
  const s = Array.isArray(supplier) ? supplier[0] : supplier;
  return s?.name ?? supplierName ?? "—";
}

export type { FinancialEntryRow } from "@/lib/financeiro/types";

export async function getDashboardMetrics(year: number, month: number) {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error, metrics: null as DashboardMetrics | null };

  const { supabase, profile } = ctx;
  const { startIso, endIso } = getMonthPeriod(year, month);

  const [
    { data: comandas },
    { data: payments },
    { data: openComandas },
    { data: paidExpenses },
    { data: pendingExpenses },
  ] = await Promise.all([
    supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", profile.clinic_id)
      .neq("status", "cancelada"),
    supabase
      .from("patient_payments")
      .select("amount, gross_amount, paid_at, plan_prepaid, refunded_at, payment_method")
      .eq("clinic_id", profile.clinic_id)
      .gte("paid_at", startIso)
      .lte("paid_at", endIso)
      .is("refunded_at", null),
    supabase
      .from("comandas")
      .select("total_amount, paid_amount, appointment:appointments(status)")
      .eq("clinic_id", profile.clinic_id)
      .in("status", ["aberta", "parcial"])
      .not("issued_at", "is", null),
    supabase
      .from("financial_entries")
      .select("amount, paid_at")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pago")
      .gte("paid_at", startIso)
      .lte("paid_at", endIso),
    supabase
      .from("financial_entries")
      .select("amount, due_date")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pendente"),
  ]);

  let receitaFaturada = 0;
  for (const c of comandas ?? []) {
    if (isComandaInPeriod(c, startIso, endIso)) {
      receitaFaturada += Number(c.total_amount);
    }
  }

  const entradasCaixa = (payments ?? []).reduce((s, p) => {
    if (p.plan_prepaid) return s;
    if (p.payment_method === "credito_interno") return s;
    return s + Number(p.gross_amount ?? p.amount);
  }, 0);
  const saidasCaixa = (paidExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  let aReceber = 0;
  for (const c of openComandas ?? []) {
    const apptRaw = (c as { appointment?: unknown }).appointment;
    const appt = Array.isArray(apptRaw) ? apptRaw[0] : apptRaw;
    if ((appt as { status?: string })?.status === "cancelada") continue;
    aReceber += Math.max(0, Number(c.total_amount) - Number(c.paid_amount));
  }

  const today = todayDateOnly();
  const in7 = addDaysDateOnly(today, 7);
  let aPagar = 0;
  let aPagarVencidas = 0;
  let aPagarVencendo7d = 0;

  for (const e of pendingExpenses ?? []) {
    const amt = Number(e.amount);
    aPagar += amt;
    const due = toDateOnly(e.due_date);
    if (due && due < today) aPagarVencidas += amt;
    else if (due && due >= today && due <= in7) aPagarVencendo7d += amt;
  }

  const metrics: DashboardMetrics = {
    receitaFaturada,
    entradasCaixa,
    aReceber,
    saidasCaixa,
    aPagar,
    aPagarVencidas,
    aPagarVencendo7d,
    resultadoPeriodo: entradasCaixa - saidasCaixa,
  };

  return { error: null, metrics };
}

export async function listOpenComandasDetailed() {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as OpenComandaRow[] };

  const { supabase, profile } = ctx;
  const { data, error } = await supabase
    .from("comandas")
    .select(
      `
      id, status, subtotal_amount, discount_amount, total_amount, paid_amount, created_at,
      patient:patients ( full_name ),
      appointment:appointments ( scheduled_at, status )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .in("status", ["aberta", "parcial"])
    .not("issued_at", "is", null)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, data: [] };

  const filtered = (data ?? []).filter((c: Record<string, unknown>) => {
    const appt = Array.isArray(c.appointment) ? c.appointment[0] : c.appointment;
    const apptStatus = (appt as { status?: string })?.status;
    return apptStatus !== "cancelada";
  });

  const ids = filtered.map((c) => c.id as string);
  const serviceByComanda = new Map<string, string>();

  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("comanda_items")
      .select("comanda_id, description, item_type")
      .in("comanda_id", ids)
      .eq("item_type", "service");

    for (const item of items ?? []) {
      if (!serviceByComanda.has(item.comanda_id as string)) {
        serviceByComanda.set(item.comanda_id as string, item.description as string);
      }
    }
  }

  const rows: OpenComandaRow[] = filtered.map((c: Record<string, unknown>) => {
    const patient = Array.isArray(c.patient) ? c.patient[0] : c.patient;
    const appt = Array.isArray(c.appointment) ? c.appointment[0] : c.appointment;
    const total = Number(c.total_amount);
    const paid = Number(c.paid_amount);
    const createdAt = String(c.created_at);
    return {
      id: String(c.id),
      status: String(c.status),
      subtotal_amount: Number(c.subtotal_amount ?? total),
      discount_amount: Number(c.discount_amount ?? 0),
      total_amount: total,
      paid_amount: paid,
      remainder: Math.max(0, total - paid),
      created_at: createdAt,
      patient_name: (patient as { full_name?: string })?.full_name ?? "—",
      scheduled_at: appt ? String((appt as { scheduled_at: string }).scheduled_at) : null,
      service_name: serviceByComanda.get(String(c.id)) ?? null,
      days_open: daysOpenSince(createdAt),
    };
  });

  return { error: null, data: rows };
}

export async function listFinancialEntries(filters?: {
  year?: number;
  month?: number;
  entry_type?: "receita" | "despesa" | "all";
  lens?: FinancialLens | "all";
  supplier_id?: string;
  category?: ExpenseCategory | "all";
  status?: "pendente" | "pago" | "cancelado" | "all";
  limit?: number;
}) {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as FinancialEntryRow[] };

  const { supabase, profile } = ctx;
  let query = supabase
    .from("financial_entries")
    .select(
      `
      id, entry_type, origin, description, amount, due_date, paid_at, status,
      supplier_name, supplier_id, patient_id, comanda_id, category, payment_method, created_at,
      supplier:suppliers ( name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (filters?.entry_type && filters.entry_type !== "all") {
    query = query.eq("entry_type", filters.entry_type);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.supplier_id) {
    query = query.eq("supplier_id", filters.supplier_id);
  }
  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  const limit = filters?.limit ?? 500;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message, data: [] };

  let rows = (data ?? []).map((r) => {
    const lens = inferLens({
      entry_type: r.entry_type as string,
      origin: r.origin as string,
      status: r.status as string,
      paid_at: r.paid_at as string | null,
      comanda_id: r.comanda_id as string | null,
    });
    return {
      id: r.id as string,
      entry_type: r.entry_type as "receita" | "despesa",
      origin: r.origin as string,
      description: r.description as string,
      amount: Number(r.amount),
      due_date: r.due_date as string | null,
      paid_at: r.paid_at as string | null,
      status: r.status as string,
      supplier_name: r.supplier_name as string | null,
      supplier_id: r.supplier_id as string | null,
      supplier_display_name: mapSupplierDisplay(
        r.supplier_name as string | null,
        r.supplier as { name: string } | { name: string }[] | null
      ),
      patient_id: r.patient_id as string | null,
      comanda_id: r.comanda_id as string | null,
      category: r.category as ExpenseCategory | null,
      payment_method: r.payment_method as string | null,
      created_at: r.created_at as string,
      lens,
    } satisfies FinancialEntryRow;
  });

  if (filters?.year && filters?.month) {
    const { startIso, endIso } = getMonthPeriod(filters.year, filters.month);
    rows = rows.filter((r) => {
      const eventDate = r.paid_at ?? r.created_at;
      return eventDate >= startIso && eventDate <= endIso;
    });
  }

  if (filters?.lens && filters.lens !== "all") {
    rows = rows.filter((r) => r.lens === filters.lens);
  }

  return { error: null, data: rows };
}

export async function listPendingManualReceitas() {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as FinancialEntryRow[] };

  const { supabase, profile } = ctx;
  const { data, error } = await supabase
    .from("financial_entries")
    .select(
      "id, entry_type, origin, description, amount, due_date, paid_at, status, supplier_name, supplier_id, patient_id, comanda_id, category, payment_method, created_at, series_id"
    )
    .eq("clinic_id", profile.clinic_id)
    .eq("entry_type", "receita")
    .eq("origin", "manual")
    .eq("status", "pendente")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return { error: error.message, data: [] };

  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    entry_type: "receita" as const,
    origin: r.origin as string,
    description: r.description as string,
    amount: Number(r.amount),
    due_date: r.due_date as string | null,
    paid_at: r.paid_at as string | null,
    status: r.status as string,
    supplier_name: r.supplier_name as string | null,
    supplier_id: r.supplier_id as string | null,
    supplier_display_name: r.supplier_name as string | null,
    patient_id: r.patient_id as string | null,
    comanda_id: r.comanda_id as string | null,
    category: r.category as ExpenseCategory | null,
    payment_method: r.payment_method as string | null,
    created_at: r.created_at as string,
    lens: "manual" as const,
    series_id: r.series_id as string | null,
    is_recurring: !!r.series_id,
  }));

  return { error: null, data: rows };
}

function classifyExpenseGroup(dueDate: string | null): ExpenseGroupKey {
  const today = todayDateOnly();
  const tomorrow = addDaysDateOnly(today, 1);
  const in7 = addDaysDateOnly(today, 7);
  const due = toDateOnly(dueDate);

  if (!due) return "futuras";
  if (due < today) return "vencidas";
  if (due === today || due === tomorrow) return "hoje_amanha";
  if (due <= in7) return "proximos_7";
  return "futuras";
}

export async function listPendingExpensesGrouped() {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as PendingExpenseRow[] };

  const { supabase, profile } = ctx;
  const { data, error } = await supabase
    .from("financial_entries")
    .select(
      `
      id, description, amount, due_date, status, category, supplier_name, supplier_id,
      series_id,
      supplier:suppliers ( name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .eq("entry_type", "despesa")
    .eq("status", "pendente")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) return { error: error.message, data: [] };

  const today = todayDateOnly();
  const rows: PendingExpenseRow[] = (data ?? []).map((r) => {
    const due = r.due_date as string | null;
    const dueOnly = toDateOnly(due);
    let days_until_due: number | null = null;
    if (dueOnly) {
      const d1 = new Date(dueOnly + "T12:00:00");
      const d2 = new Date(today + "T12:00:00");
      days_until_due = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    }
    return {
      id: r.id as string,
      description: r.description as string,
      amount: Number(r.amount),
      due_date: due,
      status: r.status as string,
      category: r.category as ExpenseCategory | null,
      supplier_id: r.supplier_id as string | null,
      supplier_display_name: mapSupplierDisplay(
        r.supplier_name as string | null,
        r.supplier as { name: string } | { name: string }[] | null
      ),
      days_until_due,
      group: classifyExpenseGroup(due),
      series_id: r.series_id as string | null,
      is_recurring: !!r.series_id,
    };
  });

  rows.sort((a, b) => {
    const order: Record<ExpenseGroupKey, number> = {
      vencidas: 0,
      hoje_amanha: 1,
      proximos_7: 2,
      futuras: 3,
    };
    const g = order[a.group] - order[b.group];
    if (g !== 0) return g;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  return { error: null, data: rows };
}

export async function listSuppliersForFinance() {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as { id: string; name: string }[] };

  const { supabase, profile } = ctx;
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .eq("active", true)
    .order("name");

  if (error) return { error: error.message, data: [] };
  return { error: null, data: (data ?? []) as { id: string; name: string }[] };
}

export async function createFinancialEntry(data: {
  entry_type: "receita" | "despesa";
  origin: "patient" | "supplier" | "manual";
  description: string;
  amount: number;
  due_date?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  category?: ExpenseCategory | null;
  mark_paid?: boolean;
  payment_method?: string | null;
  bank_account_id?: string | null;
  recurrence?: RecurrenceInput | null;
  stock_lines?: StockLineInput[];
  register_stock?: boolean;
}) {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.user || !ctx.profile) return { error: ctx.error ?? "Não autorizado." };
  if (!canManage(ctx.profile.role)) return { error: "Sem permissão." };

  if (data.entry_type === "despesa" && !data.due_date) {
    return { error: "Informe o vencimento para despesas." };
  }

  let supplierName = data.supplier_name ?? null;
  if (data.supplier_id) {
    const { data: sup } = await ctx.supabase
      .from("suppliers")
      .select("name")
      .eq("id", data.supplier_id)
      .single();
    if (sup?.name) supplierName = sup.name;
  }

  const category = data.category ?? null;
  const dreSection = category ? categoryToDreSection(category) : null;
  const competenceDate = data.due_date ?? null;

  if (data.recurrence) {
    const startDate = data.due_date!;
    const dates = generateRecurrenceDates({
      startDate,
      frequency: data.recurrence.frequency,
      interval_count: data.recurrence.interval_count,
      end_mode: data.recurrence.end_mode,
      end_count: data.recurrence.end_count,
      end_date: data.recurrence.end_date,
    });

    const { data: series, error: seriesErr } = await ctx.supabase
      .from("financial_entry_series")
      .insert({
        clinic_id: ctx.profile.clinic_id,
        entry_type: data.entry_type,
        description: data.description.trim(),
        amount: data.amount,
        category,
        supplier_id: data.supplier_id ?? null,
        payment_method: data.payment_method ?? null,
        frequency: data.recurrence.frequency,
        interval_count: data.recurrence.interval_count,
        end_mode: data.recurrence.end_mode,
        end_count: data.recurrence.end_count ?? null,
        end_date: data.recurrence.end_date ?? null,
        next_due_date:
          data.recurrence.end_mode === "never" && dates.length === 1
            ? addRecurrenceInterval(startDate, data.recurrence.frequency, data.recurrence.interval_count)
            : dates.length > 1
              ? dates[1]
              : null,
        generated_count: dates.length,
        active: data.recurrence.end_mode === "never" || dates.length < (data.recurrence.end_count ?? Infinity),
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (seriesErr) return { error: seriesErr.message };

    for (let i = 0; i < dates.length; i++) {
      const due = dates[i];
      const { error } = await ctx.supabase.from("financial_entries").insert({
        clinic_id: ctx.profile.clinic_id,
        entry_type: data.entry_type,
        origin: data.origin,
        description: data.description.trim(),
        amount: data.amount,
        due_date: due,
        competence_date: due,
        supplier_id: data.supplier_id ?? null,
        supplier_name: supplierName,
        category,
        dre_section: dreSection,
        status: "pendente",
        series_id: series?.id,
        series_index: i + 1,
        created_by: ctx.user.id,
      });
      if (error) return { error: error.message };
    }

    revalidateFinanceiro();
    return { error: null, seriesId: series?.id, count: dates.length };
  }

  const { data: inserted, error } = await ctx.supabase
    .from("financial_entries")
    .insert({
      clinic_id: ctx.profile.clinic_id,
      entry_type: data.entry_type,
      origin: data.origin,
      description: data.description.trim(),
      amount: data.amount,
      due_date: data.due_date ?? null,
      competence_date: competenceDate,
      supplier_id: data.supplier_id ?? null,
      supplier_name: supplierName,
      category,
      dre_section: dreSection,
      status: data.mark_paid ? "pago" : "pendente",
      paid_at: data.mark_paid ? new Date().toISOString() : null,
      payment_method: data.mark_paid ? data.payment_method ?? null : null,
      bank_account_id: data.mark_paid ? data.bank_account_id ?? null : null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (data.mark_paid && data.register_stock && data.stock_lines?.length && inserted?.id) {
    const stockRes = await applyStockFromExpense(
      ctx.profile.clinic_id,
      ctx.user.id,
      inserted.id as string,
      data.stock_lines
    );
    if (stockRes.error) return { error: stockRes.error };
    await ctx.supabase
      .from("financial_entries")
      .update({ origin: "stock" })
      .eq("id", inserted.id);
  }

  revalidateFinanceiro();
  return { error: null };
}

export async function updateFinancialEntry(
  id: string,
  data: {
    description: string;
    amount: number;
    due_date?: string | null;
    supplier_id?: string | null;
    category?: ExpenseCategory | null;
  }
) {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) return { error: ctx.error ?? "Não autorizado." };
  if (!canManage(ctx.profile.role)) return { error: "Sem permissão." };

  let supplierName: string | null = null;
  if (data.supplier_id) {
    const { data: sup } = await ctx.supabase
      .from("suppliers")
      .select("name")
      .eq("id", data.supplier_id)
      .single();
    supplierName = sup?.name ?? null;
  }

  const { error } = await ctx.supabase
    .from("financial_entries")
    .update({
      description: data.description.trim(),
      amount: data.amount,
      due_date: data.due_date ?? null,
      supplier_id: data.supplier_id ?? null,
      supplier_name: supplierName,
      category: data.category ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateFinanceiro();
  return { error: null };
}

export async function markEntryPaid(
  id: string,
  options?: {
    paid_at?: string;
    payment_method?: string;
    bank_account_id?: string;
    stock_lines?: StockLineInput[];
    register_stock?: boolean;
  }
) {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile || !ctx.user) return { error: ctx.error ?? "Não autorizado." };
  if (!canManage(ctx.profile.role)) return { error: "Sem permissão." };

  const paidAt = options?.paid_at
    ? new Date(options.paid_at + (options.paid_at.length <= 10 ? "T12:00:00" : "")).toISOString()
    : new Date().toISOString();

  const { error } = await ctx.supabase
    .from("financial_entries")
    .update({
      status: "pago",
      paid_at: paidAt,
      payment_method: options?.payment_method ?? null,
      bank_account_id: options?.bank_account_id ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  if (options?.register_stock && options.stock_lines?.length) {
    const stockRes = await applyStockFromExpense(
      ctx.profile.clinic_id,
      ctx.user.id,
      id,
      options.stock_lines
    );
    if (stockRes.error) return { error: stockRes.error };
    await ctx.supabase.from("financial_entries").update({ origin: "stock" }).eq("id", id);
  }

  revalidateFinanceiro();
  return { error: null };
}

export async function markEntryReceived(
  id: string,
  options?: { paid_at?: string; payment_method?: string; bank_account_id?: string }
) {
  return markEntryPaid(id, options);
}

export async function getFinanceAlerts(): Promise<{ error: string | null; alerts: FinanceAlerts }> {
  const ctx = await getFinanceProfile();
  if (ctx.error || !ctx.profile) {
    return {
      error: ctx.error,
      alerts: { comandasVencidas: 0, aguardandoEmissaoComanda: 0, contasVencerHojeAmanha: 0, contasVencidas: 0 },
    };
  }

  const { supabase, profile } = ctx;
  const today = todayDateOnly();
  const tomorrow = addDaysDateOnly(today, 1);

  const [{ data: comandas }, { data: expenses }, { data: awaitingEncounters }] = await Promise.all([
    supabase
      .from("comandas")
      .select("id, created_at, updated_at")
      .eq("clinic_id", profile.clinic_id)
      .in("status", ["aberta", "parcial"]),
    supabase
      .from("financial_entries")
      .select("due_date")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pendente"),
    supabase
      .from("encounters")
      .select("appointment_id, comandas(id, status)")
      .eq("clinic_id", profile.clinic_id)
      .eq("status", "finalizado_aguardando_cobranca"),
  ]);

  let comandasVencidas = 0;
  for (const c of comandas ?? []) {
    const ref = (c.updated_at as string) ?? (c.created_at as string);
    if (daysOpenSince(ref) > 30) comandasVencidas++;
  }

  let aguardandoEmissaoComanda = 0;
  for (const e of awaitingEncounters ?? []) {
    const cmds = Array.isArray(e.comandas) ? e.comandas : e.comandas ? [e.comandas] : [];
    const hasActive = cmds.some((c: { status?: string }) => c.status !== "cancelada");
    if (!hasActive) aguardandoEmissaoComanda++;
  }

  let contasVencerHojeAmanha = 0;
  let contasVencidas = 0;
  for (const e of expenses ?? []) {
    const due = toDateOnly(e.due_date as string | null);
    if (!due) continue;
    if (due < today) contasVencidas++;
    else if (due === today || due === tomorrow) contasVencerHojeAmanha++;
  }

  return {
    error: null,
    alerts: { comandasVencidas, aguardandoEmissaoComanda, contasVencerHojeAmanha, contasVencidas },
  };
}

/** @deprecated use getDashboardMetrics — mantido para compatibilidade */
export async function getFinancialSummary() {
  const { metrics } = await getDashboardMetrics(
    new Date().getFullYear(),
    new Date().getMonth() + 1
  );
  if (!metrics) return { error: "Erro.", summary: null };
  return {
    error: null,
    summary: {
      recebido: metrics.entradasCaixa,
      aReceber: metrics.aReceber,
      pago: metrics.saidasCaixa,
      aPagar: metrics.aPagar,
    },
  };
}

export { isComandaCompetenceEligible, comandaCompetenceDate };
