import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export async function syncAppointmentProcedures(
  supabase: Db,
  appointmentId: string,
  procedureIds: string[]
) {
  await supabase.from("appointment_procedures").delete().eq("appointment_id", appointmentId);
  if (!procedureIds.length) return;
  await supabase.from("appointment_procedures").insert(
    procedureIds.map((procedure_id, sort_order) => ({
      appointment_id: appointmentId,
      procedure_id,
      sort_order,
    }))
  );
  const primary = procedureIds[0];
  if (primary) {
    await supabase.from("appointments").update({ procedure_id: primary }).eq("id", appointmentId);
  }
}

export async function getProcedureDefaults(
  supabase: Db,
  procedureIds: string[]
): Promise<{
  defaultServiceId: string | null;
  defaultAppointmentTypeId: string | null;
  mergedRecommendations: string;
}> {
  if (!procedureIds.length) {
    return { defaultServiceId: null, defaultAppointmentTypeId: null, mergedRecommendations: "" };
  }
  const { data } = await supabase
    .from("procedures")
    .select("id, default_service_id, default_appointment_type_id, recommendations, display_order")
    .in("id", procedureIds)
    .order("display_order", { ascending: true });

  const rows = data ?? [];
  const first = rows[0];
  const recs = rows
    .map((p) => p.recommendations?.trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    defaultServiceId: first?.default_service_id ?? null,
    defaultAppointmentTypeId: first?.default_appointment_type_id ?? null,
    mergedRecommendations: recs,
  };
}

export async function buildConsumptionFromProcedures(
  supabase: Db,
  appointmentId: string,
  procedureIds: string[]
) {
  if (!procedureIds.length) return;
  const { data: bom } = await supabase
    .from("procedure_products")
    .select("product_id, quantity_per_procedure")
    .in("procedure_id", procedureIds);

  const qtyByProduct: Record<string, number> = {};
  for (const row of bom ?? []) {
    const q = Number(row.quantity_per_procedure) || 1;
    qtyByProduct[row.product_id] = (qtyByProduct[row.product_id] ?? 0) + q;
  }

  const lines = Object.entries(qtyByProduct).map(([product_id, quantity]) => ({
    appointment_id: appointmentId,
    product_id,
    quantity,
    source: "procedure_default" as const,
  }));

  if (!lines.length) return;

  await supabase.from("appointment_consumption_lines").delete().eq("appointment_id", appointmentId);
  await supabase.from("appointment_consumption_lines").insert(lines);
}

export async function commitStockForAppointment(supabase: Db, clinicId: string, appointmentId: string, userId?: string) {
  const { data: lines } = await supabase
    .from("appointment_consumption_lines")
    .select("product_id, quantity")
    .eq("appointment_id", appointmentId)
    .is("locked_at", null);

  for (const line of lines ?? []) {
    const qty = Number(line.quantity);
    if (qty <= 0) continue;

    const { data: product } = await supabase
      .from("products")
      .select("id, clinic_id")
      .eq("id", line.product_id)
      .single();
    if (!product) continue;

    const { data: balance } = await supabase
      .from("stock_balances")
      .select("quantity_on_hand, quantity_committed")
      .eq("product_id", line.product_id)
      .maybeSingle();

    if (!balance) {
      await supabase.from("stock_balances").insert({
        product_id: line.product_id,
        clinic_id: clinicId,
        quantity_on_hand: 0,
        quantity_committed: qty,
      });
    } else {
      await supabase
        .from("stock_balances")
        .update({
          quantity_committed: Number(balance.quantity_committed) + qty,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", line.product_id);
    }

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: line.product_id,
      appointment_id: appointmentId,
      movement_type: "committed",
      quantity: qty,
      created_by: userId ?? null,
    });
  }
}

export async function releaseStockForAppointment(supabase: Db, clinicId: string, appointmentId: string, userId?: string) {
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("product_id, quantity")
    .eq("appointment_id", appointmentId)
    .eq("movement_type", "committed");

  for (const m of movements ?? []) {
    const qty = Number(m.quantity);
    const { data: balance } = await supabase
      .from("stock_balances")
      .select("quantity_committed")
      .eq("product_id", m.product_id)
      .maybeSingle();

    if (balance) {
      await supabase
        .from("stock_balances")
        .update({
          quantity_committed: Math.max(0, Number(balance.quantity_committed) - qty),
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", m.product_id);
    }

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: m.product_id,
      appointment_id: appointmentId,
      movement_type: "released",
      quantity: qty,
      created_by: userId ?? null,
    });
  }
}

export async function consumeStockForAppointment(supabase: Db, clinicId: string, appointmentId: string, userId?: string) {
  const { data: lines } = await supabase
    .from("appointment_consumption_lines")
    .select("product_id, quantity")
    .eq("appointment_id", appointmentId);

  for (const line of lines ?? []) {
    const qty = Number(line.quantity);
    if (qty <= 0) continue;

    const { data: balance } = await supabase
      .from("stock_balances")
      .select("quantity_on_hand, quantity_committed")
      .eq("product_id", line.product_id)
      .maybeSingle();

    if (balance) {
      await supabase
        .from("stock_balances")
        .update({
          quantity_on_hand: Math.max(0, Number(balance.quantity_on_hand) - qty),
          quantity_committed: Math.max(0, Number(balance.quantity_committed) - qty),
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", line.product_id);
    }

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: line.product_id,
      appointment_id: appointmentId,
      movement_type: "consumed",
      quantity: qty,
      created_by: userId ?? null,
    });
  }
}

export async function ensureEncounter(supabase: Db, clinicId: string, appointmentId: string) {
  const { data: existing } = await supabase
    .from("encounters")
    .select("id, status")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabase
    .from("encounters")
    .insert({
      clinic_id: clinicId,
      appointment_id: appointmentId,
      status: "em_andamento",
      started_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();

  return created;
}

export async function resolveMultiProcedurePrice(
  supabase: Db,
  clinicId: string,
  procedureIds: string[],
  professionalId: string,
  dimensionValueIds: string[],
  resolvePrice: (
    serviceId: string,
    professionalId: string,
    dimensionValueIds: string[]
  ) => Promise<{ valor: number | null }>
): Promise<number | null> {
  if (!procedureIds.length) return null;

  const { data: procs } = await supabase
    .from("procedures")
    .select("default_service_id")
    .in("id", procedureIds);

  let total = 0;
  let hasAny = false;
  const seenServices = new Set<string>();

  for (const p of procs ?? []) {
    const sid = p.default_service_id;
    if (!sid || seenServices.has(sid)) continue;
    seenServices.add(sid);
    const { valor } = await resolvePrice(sid, professionalId, dimensionValueIds);
    if (valor != null) {
      total += valor;
      hasAny = true;
    }
  }
  return hasAny ? total : null;
}
