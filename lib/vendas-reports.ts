"use server";

import { createClient } from "@/lib/supabase/server";

export async function getVendasOverview(days = 30) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: null };
  }

  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  const { data: comandas } = await supabase
    .from("comandas")
    .select("id, total_amount, status, created_at")
    .eq("clinic_id", profile.clinic_id)
    .neq("status", "cancelada")
    .gte("created_at", startIso);

  const list = comandas ?? [];
  const totalVendas = list.reduce((s, c) => s + Number(c.total_amount), 0);
  const count = list.length;
  const ticketMedio = count > 0 ? totalVendas / count : 0;

  const { data: items } = await supabase
    .from("comanda_items")
    .select("description, item_type, total_price, comanda_id")
    .in(
      "comanda_id",
      list.map((c) => c.id)
    );

  const byService: Record<string, number> = {};
  for (const item of items ?? []) {
    if (item.item_type === "service") {
      byService[item.description] = (byService[item.description] ?? 0) + Number(item.total_price);
    }
  }
  const topServicos = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  return {
    error: null,
    data: {
      totalVendas,
      count,
      ticketMedio,
      topServicos,
      periodDays: days,
    },
  };
}

export async function getVendasRelatorio(days = 30) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: [] };
  }

  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data } = await supabase
    .from("comandas")
    .select(
      `
      id,
      total_amount,
      paid_amount,
      status,
      created_at,
      closed_at,
      patient:patients ( full_name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .neq("status", "cancelada")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false });

  return {
    error: null,
    data: (data ?? []).map((c: Record<string, unknown>) => {
      const patient = Array.isArray(c.patient) ? c.patient[0] : c.patient;
      return {
        id: c.id as string,
        total_amount: Number(c.total_amount),
        paid_amount: Number(c.paid_amount),
        status: c.status as string,
        created_at: c.created_at as string,
        patient_name: (patient as { full_name?: string })?.full_name ?? "—",
      };
    }),
  };
}
