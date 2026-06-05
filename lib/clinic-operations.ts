import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type BomLineEstimate,
  productChargeUnitPrice,
  sumBomLines,
} from "@/lib/appointment-charge";

type Db = SupabaseClient;

async function pickFefoLots(
  supabase: Db,
  clinicId: string,
  productId: string,
  qtyNeeded: number
): Promise<{ lotId: string; qty: number; expiry_date: string | null }[]> {
  const { data: lots } = await supabase
    .from("stock_lots")
    .select("id, quantity_on_hand, quantity_committed, expiry_date")
    .eq("clinic_id", clinicId)
    .eq("product_id", productId)
    .gt("quantity_on_hand", 0)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  const allocations: { lotId: string; qty: number; expiry_date: string | null }[] = [];
  let remaining = qtyNeeded;

  for (const lot of lots ?? []) {
    if (remaining <= 0) break;
    const available =
      Number(lot.quantity_on_hand) - Number(lot.quantity_committed ?? 0);
    if (available <= 0) continue;
    const take = Math.min(remaining, available);
    allocations.push({
      lotId: String(lot.id),
      qty: take,
      expiry_date: lot.expiry_date ? String(lot.expiry_date) : null,
    });
    remaining -= take;
  }

  return allocations;
}

async function commitLotAllocations(
  supabase: Db,
  clinicId: string,
  appointmentId: string,
  productId: string,
  qty: number,
  userId?: string
) {
  const allocations = await pickFefoLots(supabase, clinicId, productId, qty);
  if (!allocations.length) return;

  for (const alloc of allocations) {
    const { data: lot } = await supabase
      .from("stock_lots")
      .select("quantity_committed")
      .eq("id", alloc.lotId)
      .single();

    if (lot) {
      await supabase
        .from("stock_lots")
        .update({
          quantity_committed: Number(lot.quantity_committed ?? 0) + alloc.qty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alloc.lotId);
    }

    await supabase.from("appointment_stock_lots").upsert(
      {
        appointment_id: appointmentId,
        product_id: productId,
        stock_lot_id: alloc.lotId,
        quantity: alloc.qty,
      },
      { onConflict: "appointment_id,product_id,stock_lot_id" }
    );

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: productId,
      appointment_id: appointmentId,
      stock_lot_id: alloc.lotId,
      movement_type: "committed",
      quantity: alloc.qty,
      created_by: userId ?? null,
    });
  }
}

async function releaseLotAllocations(
  supabase: Db,
  clinicId: string,
  appointmentId: string,
  userId?: string
) {
  const { data: rows } = await supabase
    .from("appointment_stock_lots")
    .select("product_id, stock_lot_id, quantity")
    .eq("appointment_id", appointmentId);

  for (const row of rows ?? []) {
    const qty = Number(row.quantity);
    const { data: lot } = await supabase
      .from("stock_lots")
      .select("quantity_committed")
      .eq("id", row.stock_lot_id)
      .single();

    if (lot) {
      await supabase
        .from("stock_lots")
        .update({
          quantity_committed: Math.max(0, Number(lot.quantity_committed ?? 0) - qty),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.stock_lot_id);
    }

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: row.product_id,
      appointment_id: appointmentId,
      stock_lot_id: row.stock_lot_id,
      movement_type: "released",
      quantity: qty,
      created_by: userId ?? null,
    });
  }

  if (rows?.length) {
    await supabase.from("appointment_stock_lots").delete().eq("appointment_id", appointmentId);
  }
}

async function consumeLotAllocations(
  supabase: Db,
  clinicId: string,
  appointmentId: string,
  userId?: string
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("appointment_stock_lots")
    .select("product_id, stock_lot_id, quantity, stock_lots(expiry_date)")
    .eq("appointment_id", appointmentId);

  for (const row of rows ?? []) {
    const qty = Number(row.quantity);
    const lotMeta = Array.isArray(row.stock_lots) ? row.stock_lots[0] : row.stock_lots;
    const expiry = (lotMeta as { expiry_date?: string | null })?.expiry_date;
    const expired = expiry != null && expiry < today;

    const { data: lot } = await supabase
      .from("stock_lots")
      .select("quantity_on_hand, quantity_committed")
      .eq("id", row.stock_lot_id)
      .single();

    if (lot) {
      await supabase
        .from("stock_lots")
        .update({
          quantity_on_hand: Math.max(0, Number(lot.quantity_on_hand) - qty),
          quantity_committed: Math.max(0, Number(lot.quantity_committed ?? 0) - qty),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.stock_lot_id);
    }

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: row.product_id,
      appointment_id: appointmentId,
      stock_lot_id: row.stock_lot_id,
      movement_type: "consumed",
      quantity: qty,
      expired_at_consumption: expired,
      created_by: userId ?? null,
    });
  }

  if (rows?.length) {
    await supabase.from("appointment_stock_lots").delete().eq("appointment_id", appointmentId);
  }
}

export type { BomLineEstimate } from "@/lib/appointment-charge";
export { sumBomLines, productChargeUnitPrice } from "@/lib/appointment-charge";

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
  const { error } = await supabase.from("appointment_consumption_lines").insert(lines);
  if (error) {
    console.error("[buildConsumptionFromProcedures] insert:", error.message);
    throw new Error(error.message);
  }
}

/** Garante linhas de consumo a partir do BOM do procedimento (consultas antigas ou falha no agendamento). */
export async function ensureAppointmentConsumptionLines(
  supabase: Db,
  clinicId: string,
  appointmentId: string,
  userId?: string
) {
  const { count, error: countErr } = await supabase
    .from("appointment_consumption_lines")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointmentId);

  if (countErr) {
    console.error("[ensureAppointmentConsumptionLines] count:", countErr.message);
    return;
  }
  if (count && count > 0) return;

  const { data: apProcs } = await supabase
    .from("appointment_procedures")
    .select("procedure_id")
    .eq("appointment_id", appointmentId)
    .order("sort_order");

  let procedureIds = (apProcs ?? []).map((r) => r.procedure_id as string);

  if (!procedureIds.length) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("procedure_id")
      .eq("id", appointmentId)
      .maybeSingle();
    if (appt?.procedure_id) procedureIds = [appt.procedure_id as string];
  }

  if (!procedureIds.length) return;

  try {
    await buildConsumptionFromProcedures(supabase, appointmentId, procedureIds);
  } catch (e) {
    console.error("[ensureAppointmentConsumptionLines] build:", e);
    return;
  }

  const { data: apptStatus } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .maybeSingle();

  const status = apptStatus?.status as string | undefined;
  if (status === "cancelada" || status === "falta") return;

  const { data: committed } = await supabase
    .from("stock_movements")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("movement_type", "committed")
    .limit(1);

  if (committed?.length) return;

  try {
    await commitStockForAppointment(supabase, clinicId, appointmentId, userId);
  } catch (e) {
    console.error("[ensureAppointmentConsumptionLines] stock commit:", e);
  }
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

    try {
      await commitLotAllocations(
        supabase,
        clinicId,
        appointmentId,
        line.product_id,
        qty,
        userId
      );
    } catch (e) {
      console.error("[commitStock] lot FEFO:", e);
    }
  }
}

export async function releaseStockForAppointment(supabase: Db, clinicId: string, appointmentId: string, userId?: string) {
  try {
    await releaseLotAllocations(supabase, clinicId, appointmentId, userId);
  } catch (e) {
    console.error("[releaseStock] lot FEFO:", e);
  }

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
  try {
    await consumeLotAllocations(supabase, clinicId, appointmentId, userId);
  } catch (e) {
    console.error("[consumeStock] lot FEFO:", e);
  }

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

export async function hasStockBeenConsumed(supabase: Db, appointmentId: string): Promise<boolean> {
  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointmentId)
    .eq("movement_type", "consumed");
  return (count ?? 0) > 0;
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

/** BOM agregado dos procedimentos com preço de cobrança por produto. */
export async function getBomEstimateForProcedures(
  supabase: Db,
  procedureIds: string[]
): Promise<BomLineEstimate[]> {
  if (!procedureIds.length) return [];

  const { data: bom } = await supabase
    .from("procedure_products")
    .select(
      "product_id, quantity_per_procedure, products(id, name, cost, sale_price)"
    )
    .in("procedure_id", procedureIds);

  const qtyByProduct: Record<string, number> = {};
  const productMeta: Record<string, { name: string; cost: number; sale_price: number | null }> = {};

  for (const row of bom ?? []) {
    const pid = row.product_id as string;
    const q = Number(row.quantity_per_procedure) || 1;
    qtyByProduct[pid] = (qtyByProduct[pid] ?? 0) + q;
    const prod = Array.isArray(row.products) ? row.products[0] : row.products;
    if (prod && !productMeta[pid]) {
      productMeta[pid] = {
        name: String((prod as { name: string }).name),
        cost: Number((prod as { cost?: number }).cost) || 0,
        sale_price:
          (prod as { sale_price?: number | null }).sale_price != null
            ? Number((prod as { sale_price: number }).sale_price)
            : null,
      };
    }
  }

  return Object.entries(qtyByProduct).map(([product_id, quantity]) => {
    const meta = productMeta[product_id];
    const unit_price = productChargeUnitPrice(meta?.sale_price, meta?.cost ?? 0);
    return {
      product_id,
      product_name: meta?.name ?? "Material",
      quantity,
      unit_price,
      line_total: Number((quantity * unit_price).toFixed(2)),
    };
  });
}

export type BillingTotalsOptions = {
  includeMaterials?: boolean;
  discountAmount?: number;
  discountPercent?: number;
};

/** Totais de cobrança a partir do serviço resolvido e linhas de consumo. */
export function computeBillingFromLines(
  serviceAmount: number,
  consumption: { quantity: number; sale_price?: number | null; cost?: number }[],
  options?: BillingTotalsOptions
): {
  serviceAmount: number;
  materialsAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
} {
  const materialsAmount = consumption.reduce((s, line) => {
    const unit = productChargeUnitPrice(line.sale_price, Number(line.cost) || 0);
    return s + Number(line.quantity) * unit;
  }, 0);
  const materialsRounded = Number(materialsAmount.toFixed(2));
  const serviceRounded = Number(Math.max(0, serviceAmount).toFixed(2));
  const includeMaterials = options?.includeMaterials !== false;
  const subtotalAmount = Number(
    (serviceRounded + (includeMaterials ? materialsRounded : 0)).toFixed(2)
  );

  let discountAmount = 0;
  if (options?.discountPercent != null && options.discountPercent > 0) {
    discountAmount = Number(((subtotalAmount * options.discountPercent) / 100).toFixed(2));
  } else if (options?.discountAmount != null && options.discountAmount > 0) {
    discountAmount = Number(options.discountAmount.toFixed(2));
  }
  discountAmount = Math.min(discountAmount, subtotalAmount);

  return {
    serviceAmount: serviceRounded,
    materialsAmount: materialsRounded,
    subtotalAmount,
    discountAmount,
    totalAmount: Number((subtotalAmount - discountAmount).toFixed(2)),
  };
}
