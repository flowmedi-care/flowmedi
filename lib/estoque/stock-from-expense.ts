"use server";

import { createClient } from "@/lib/supabase/server";
import type { StockLineInput } from "@/lib/financeiro/types";

export async function applyStockFromExpense(
  clinicId: string,
  userId: string,
  financialEntryId: string,
  lines: StockLineInput[]
) {
  if (!lines.length) return { error: null };

  const supabase = await createClient();

  for (const line of lines) {
    const { error: lineErr } = await supabase.from("financial_entry_stock_lines").insert({
      financial_entry_id: financialEntryId,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      lot_code: line.lot_code ?? null,
      expiry_date: line.expiry_date ?? null,
    });
    if (lineErr) return { error: lineErr.message };

    const { data: balance } = await supabase
      .from("stock_balances")
      .select("quantity_on_hand")
      .eq("product_id", line.product_id)
      .maybeSingle();

    const newQty = (balance ? Number(balance.quantity_on_hand) : 0) + line.quantity;

    if (balance) {
      await supabase
        .from("stock_balances")
        .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
        .eq("product_id", line.product_id);
    } else {
      await supabase.from("stock_balances").insert({
        product_id: line.product_id,
        clinic_id: clinicId,
        quantity_on_hand: newQty,
        quantity_committed: 0,
      });
    }

    await supabase.from("stock_movements").insert({
      clinic_id: clinicId,
      product_id: line.product_id,
      movement_type: "adjustment",
      quantity: line.quantity,
      notes: `Entrada via despesa ${financialEntryId}`,
      created_by: userId,
    });

    if (line.lot_code || line.expiry_date) {
      await supabase.from("stock_lots").insert({
        clinic_id: clinicId,
        product_id: line.product_id,
        lot_code: line.lot_code ?? `LOTE-${Date.now()}`,
        expiry_date: line.expiry_date ?? null,
        quantity_on_hand: line.quantity,
      });
    }

    await supabase
      .from("products")
      .update({ cost: line.unit_cost, updated_at: new Date().toISOString() })
      .eq("id", line.product_id);
  }

  return { error: null };
}

export async function listProductsBySupplier(supplierId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data, error } = await supabase
    .from("products")
    .select("id, name, unit, cost, sku")
    .eq("clinic_id", profile.clinic_id)
    .eq("supplier_id", supplierId)
    .eq("active", true)
    .order("name");

  if (error) return { error: error.message, data: [] };
  return {
    error: null,
    data: (data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      unit: p.unit as string,
      cost: Number(p.cost),
      sku: p.sku as string | null,
    })),
  };
}
