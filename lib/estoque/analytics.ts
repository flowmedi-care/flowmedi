"use server";

import { createClient } from "@/lib/supabase/server";

export type StockOverviewMetrics = {
  totalValue: number;
  lowStockCount: number;
  expiringCount: number;
  movementsThisMonth: number;
  committedReal: number;
  committedPredicted: number;
  noShowRate: number;
  topConsumption: { name: string; quantity: number }[];
  inOutByMonth: { month: string; label: string; inflow: number; outflow: number }[];
};

async function getStockContext() {
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
  return { error: null, supabase, clinicId: profile.clinic_id, role: profile.role };
}

export async function getStockOverviewMetrics(): Promise<{
  error: string | null;
  data: StockOverviewMetrics | null;
}> {
  const ctx = await getStockContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: null };

  const { supabase, clinicId } = ctx;

  const [{ data: products }, { data: balances }, { data: lots }, { data: movements }] =
    await Promise.all([
      supabase.from("products").select("id, name, cost, min_quantity, active").eq("clinic_id", clinicId).eq("active", true),
      supabase.from("stock_balances").select("product_id, quantity_on_hand, quantity_committed").eq("clinic_id", clinicId),
      supabase
        .from("stock_lots")
        .select("id, expiry_date, quantity_on_hand, product:products!inner(clinic_id)")
        .eq("product.clinic_id", clinicId),
      supabase
        .from("stock_movements")
        .select("movement_type, quantity, created_at, product_id, product:products(name)")
        .eq("clinic_id", clinicId)
        .gte("created_at", new Date(new Date().setDate(1)).toISOString()),
    ]);

  const balanceMap = new Map<string, { on_hand: number; committed: number }>();
  for (const b of balances ?? []) {
    balanceMap.set(b.product_id as string, {
      on_hand: Number(b.quantity_on_hand),
      committed: Number(b.quantity_committed),
    });
  }

  let totalValue = 0;
  let lowStockCount = 0;
  let committedReal = 0;
  const productCost = new Map<string, number>();
  for (const p of products ?? []) {
    const bal = balanceMap.get(p.id as string) ?? { on_hand: 0, committed: 0 };
    const cost = Number(p.cost);
    productCost.set(p.id as string, cost);
    totalValue += bal.on_hand * cost;
    committedReal += bal.committed * cost;
    const minQty = Number(p.min_quantity ?? 0);
    if (minQty > 0 && bal.on_hand <= minQty) lowStockCount++;
  }

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  let expiringCount = 0;
  for (const lot of lots ?? []) {
    const exp = lot.expiry_date as string | null;
    if (exp && new Date(exp) <= in30 && Number(lot.quantity_on_hand) > 0) expiringCount++;
  }

  const start90 = new Date();
  start90.setDate(start90.getDate() - 90);
  const { data: appts } = await supabase
    .from("appointments")
    .select("status")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start90.toISOString())
    .in("status", ["concluida", "falta"]);

  const apptTotal = (appts ?? []).length;
  const faltas = (appts ?? []).filter((a) => a.status === "falta").length;
  const noShowRate = apptTotal > 0 ? faltas / apptTotal : 0;
  const committedPredicted = committedReal * (1 - noShowRate);

  const consumptionMap: Record<string, { name: string; quantity: number }> = {};
  for (const m of movements ?? []) {
    if (m.movement_type !== "consumed") continue;
    const pid = m.product_id as string;
    const product = Array.isArray(m.product) ? m.product[0] : m.product;
    const name = (product as { name?: string })?.name ?? "Produto";
    if (!consumptionMap[pid]) consumptionMap[pid] = { name, quantity: 0 };
    consumptionMap[pid].quantity += Math.abs(Number(m.quantity));
  }
  const topConsumption = Object.values(consumptionMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const monthStart = new Date();
  monthStart.setMonth(monthStart.getMonth() - 5);
  const { data: allMovements } = await supabase
    .from("stock_movements")
    .select("movement_type, quantity, created_at")
    .eq("clinic_id", clinicId)
    .gte("created_at", monthStart.toISOString());

  const inOutByMonth: Record<string, { inflow: number; outflow: number }> = {};
  for (const m of allMovements ?? []) {
    const month = (m.created_at as string).slice(0, 7);
    if (!inOutByMonth[month]) inOutByMonth[month] = { inflow: 0, outflow: 0 };
    const qty = Math.abs(Number(m.quantity));
    if (m.movement_type === "adjustment" && Number(m.quantity) > 0) {
      inOutByMonth[month].inflow += qty;
    } else if (m.movement_type === "consumed") {
      inOutByMonth[month].outflow += qty;
    }
  }

  const inOutArr = Object.entries(inOutByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      label: new Date(month + "-01T12:00:00").toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
      inflow: v.inflow,
      outflow: v.outflow,
    }));

  return {
    error: null,
    data: {
      totalValue,
      lowStockCount,
      expiringCount,
      movementsThisMonth: (movements ?? []).length,
      committedReal,
      committedPredicted,
      noShowRate: noShowRate * 100,
      topConsumption,
      inOutByMonth: inOutArr,
    },
  };
}

export type StockCategoryRow = {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  icon: string | null;
  product_count: number;
  low_stock_count: number;
};

export async function listStockCategories(): Promise<{
  error: string | null;
  data: StockCategoryRow[];
}> {
  const ctx = await getStockContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: [] };

  const { data: categories, error } = await ctx.supabase
    .from("stock_categories")
    .select("id, name, slug, display_order, icon")
    .eq("clinic_id", ctx.clinicId)
    .order("display_order");

  if (error) return { error: error.message, data: [] };

  const [{ data: products }, { data: balances }] = await Promise.all([
    ctx.supabase
      .from("products")
      .select("id, category_id, min_quantity")
      .eq("clinic_id", ctx.clinicId)
      .eq("active", true),
    ctx.supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand")
      .eq("clinic_id", ctx.clinicId),
  ]);

  const balanceMap = new Map<string, number>();
  for (const b of balances ?? []) {
    balanceMap.set(b.product_id as string, Number(b.quantity_on_hand));
  }

  const counts: Record<string, number> = {};
  const lowCounts: Record<string, number> = {};
  for (const p of products ?? []) {
    const cid = p.category_id as string | null;
    if (!cid) continue;
    counts[cid] = (counts[cid] ?? 0) + 1;
    const minQty = Number(p.min_quantity ?? 0);
    const onHand = balanceMap.get(p.id as string) ?? 0;
    if (minQty > 0 && onHand <= minQty) {
      lowCounts[cid] = (lowCounts[cid] ?? 0) + 1;
    }
  }

  return {
    error: null,
    data: (categories ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      slug: c.slug as string,
      display_order: Number(c.display_order),
      icon: c.icon as string | null,
      product_count: counts[c.id as string] ?? 0,
      low_stock_count: lowCounts[c.id as string] ?? 0,
    })),
  };
}

export async function createStockCategory(name: string) {
  const ctx = await getStockContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro" };
  if (ctx.role !== "admin") return { error: "Apenas administradores." };

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { count } = await ctx.supabase
    .from("stock_categories")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", ctx.clinicId);

  const { error } = await ctx.supabase.from("stock_categories").insert({
    clinic_id: ctx.clinicId,
    name: name.trim(),
    slug,
    display_order: (count ?? 0) + 1,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function seedDefaultStockCategories(clinicId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const defaults = ["Produtos", "Medicamentos", "Materiais"];
  for (let i = 0; i < defaults.length; i++) {
    const name = defaults[i];
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    await supabase.from("stock_categories").upsert(
      { clinic_id: clinicId, name, slug, display_order: i + 1 },
      { onConflict: "clinic_id,slug", ignoreDuplicates: true }
    );
  }
}
