"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  cost: number;
  sale_price: number | null;
  expiry_tracked: boolean;
  active: boolean;
  quantity_on_hand: number;
  quantity_committed: number;
};

async function getClinicContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, clinicId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", supabase, clinicId: null };
  return { error: null, supabase, clinicId: profile.clinic_id, userId: user.id, role: profile.role };
}

export async function listProducts(): Promise<{ error: string | null; data: ProductRow[] }> {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro", data: [] };

  const { data: products, error } = await ctx.supabase
    .from("products")
    .select("id, name, sku, unit, cost, sale_price, expiry_tracked, active")
    .eq("clinic_id", ctx.clinicId)
    .order("name");

  if (error) return { error: error.message, data: [] };

  const ids = (products ?? []).map((p) => p.id);
  const balances: Record<string, { on_hand: number; committed: number }> = {};
  if (ids.length) {
    const { data: bal } = await ctx.supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand, quantity_committed")
      .in("product_id", ids);
    for (const b of bal ?? []) {
      balances[b.product_id] = {
        on_hand: Number(b.quantity_on_hand),
        committed: Number(b.quantity_committed),
      };
    }
  }

  return {
    error: null,
    data: (products ?? []).map((p) => ({
      ...p,
      cost: Number(p.cost),
      sale_price: p.sale_price != null ? Number(p.sale_price) : null,
      quantity_on_hand: balances[p.id]?.on_hand ?? 0,
      quantity_committed: balances[p.id]?.committed ?? 0,
    })),
  };
}

export async function createProduct(data: {
  name: string;
  sku?: string | null;
  unit: string;
  cost: number;
  sale_price?: number | null;
  initial_quantity?: number;
}) {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro" };
  if (ctx.role !== "admin") return { error: "Apenas administradores podem cadastrar produtos." };

  const { data: product, error } = await ctx.supabase
    .from("products")
    .insert({
      clinic_id: ctx.clinicId,
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      unit: data.unit.trim() || "un",
      cost: data.cost,
      sale_price: data.sale_price ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const qty = data.initial_quantity ?? 0;
  if (product?.id && qty > 0) {
    await ctx.supabase.from("stock_balances").insert({
      product_id: product.id,
      clinic_id: ctx.clinicId,
      quantity_on_hand: qty,
      quantity_committed: 0,
    });
    await ctx.supabase.from("stock_movements").insert({
      clinic_id: ctx.clinicId,
      product_id: product.id,
      movement_type: "adjustment",
      quantity: qty,
      notes: "Saldo inicial",
      created_by: ctx.userId,
    });
  } else if (product?.id) {
    await ctx.supabase.from("stock_balances").insert({
      product_id: product.id,
      clinic_id: ctx.clinicId,
      quantity_on_hand: 0,
      quantity_committed: 0,
    });
  }

  revalidatePath("/dashboard/estoque");
  return { error: null, id: product?.id };
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    sku: string | null;
    unit: string;
    cost: number;
    sale_price: number | null;
    active: boolean;
  }>
) {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro" };
  if (ctx.role !== "admin") return { error: "Apenas administradores." };

  const { error } = await ctx.supabase
    .from("products")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/estoque");
  return { error: null };
}

export async function adjustStock(productId: string, quantity: number, notes?: string) {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro" };

  const { data: balance } = await ctx.supabase
    .from("stock_balances")
    .select("quantity_on_hand")
    .eq("product_id", productId)
    .maybeSingle();

  const newQty = (balance ? Number(balance.quantity_on_hand) : 0) + quantity;

  if (balance) {
    await ctx.supabase
      .from("stock_balances")
      .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
      .eq("product_id", productId);
  } else {
    await ctx.supabase.from("stock_balances").insert({
      product_id: productId,
      clinic_id: ctx.clinicId,
      quantity_on_hand: newQty,
      quantity_committed: 0,
    });
  }

  await ctx.supabase.from("stock_movements").insert({
    clinic_id: ctx.clinicId,
    product_id: productId,
    movement_type: "adjustment",
    quantity,
    notes: notes ?? null,
    created_by: ctx.userId,
  });

  revalidatePath("/dashboard/estoque");
  return { error: null };
}
