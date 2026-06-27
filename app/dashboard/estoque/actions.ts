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
  category_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  image_url: string | null;
  track_lot: boolean;
  track_expiry: boolean;
  min_quantity: number;
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

function mapProducts(
  products: Record<string, unknown>[],
  balances: Record<string, { on_hand: number; committed: number }>
): ProductRow[] {
  return products.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    sku: p.sku as string | null,
    unit: p.unit as string,
    cost: Number(p.cost),
    sale_price: p.sale_price != null ? Number(p.sale_price) : null,
    expiry_tracked: Boolean(p.expiry_tracked),
    active: Boolean(p.active),
    quantity_on_hand: balances[p.id as string]?.on_hand ?? 0,
    quantity_committed: balances[p.id as string]?.committed ?? 0,
    category_id: p.category_id as string | null,
    supplier_id: p.supplier_id as string | null,
    supplier_name: null,
    image_url: p.image_url as string | null,
    track_lot: Boolean(p.track_lot),
    track_expiry: Boolean(p.track_expiry),
    min_quantity: Number(p.min_quantity ?? 0),
  }));
}

async function attachBalances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  products: Record<string, unknown>[]
) {
  const ids = products.map((p) => p.id as string);
  const balances: Record<string, { on_hand: number; committed: number }> = {};
  if (ids.length) {
    const { data: bal } = await supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand, quantity_committed")
      .in("product_id", ids);
    for (const b of bal ?? []) {
      balances[b.product_id as string] = {
        on_hand: Number(b.quantity_on_hand),
        committed: Number(b.quantity_committed),
      };
    }
  }
  return mapProducts(products, balances);
}

export async function listProducts(): Promise<{ error: string | null; data: ProductRow[] }> {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro", data: [] };

  const { data: products, error } = await ctx.supabase
    .from("products")
    .select(
      "id, name, sku, unit, cost, sale_price, expiry_tracked, active, category_id, supplier_id, image_url, track_lot, track_expiry, min_quantity, supplier:suppliers(name)"
    )
    .eq("clinic_id", ctx.clinicId)
    .order("name");

  if (error) return { error: error.message, data: [] };

  const rows = await attachBalances(ctx.supabase, products ?? []);
  for (let i = 0; i < rows.length; i++) {
    const sup = (products ?? [])[i]?.supplier;
    const s = Array.isArray(sup) ? sup[0] : sup;
    rows[i].supplier_name = (s as { name?: string })?.name ?? null;
  }
  return { error: null, data: rows };
}

export async function listProductsByCategorySlug(slug: string) {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, category: null, data: [] as ProductRow[] };

  const { data: category } = await ctx.supabase
    .from("stock_categories")
    .select("id, name, slug")
    .eq("clinic_id", ctx.clinicId)
    .eq("slug", slug)
    .maybeSingle();

  if (!category) return { error: "Categoria não encontrada.", category: null, data: [] };

  const { data: products, error } = await ctx.supabase
    .from("products")
    .select(
      "id, name, sku, unit, cost, sale_price, expiry_tracked, active, category_id, supplier_id, image_url, track_lot, track_expiry, min_quantity, supplier:suppliers(name)"
    )
    .eq("clinic_id", ctx.clinicId)
    .eq("category_id", category.id)
    .order("name");

  if (error) return { error: error.message, category, data: [] };

  const rows = await attachBalances(ctx.supabase, products ?? []);
  for (let i = 0; i < rows.length; i++) {
    const sup = (products ?? [])[i]?.supplier;
    const s = Array.isArray(sup) ? sup[0] : sup;
    rows[i].supplier_name = (s as { name?: string })?.name ?? null;
  }
  return { error: null, category, data: rows };
}

export async function listSuppliersForStock() {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: [] };

  const { data, error } = await ctx.supabase
    .from("suppliers")
    .select("id, name")
    .eq("clinic_id", ctx.clinicId)
    .eq("active", true)
    .order("name");

  if (error) return { error: error.message, data: [] };
  return { error: null, data: data ?? [] };
}

export async function createProduct(data: {
  name: string;
  sku?: string | null;
  unit: string;
  cost: number;
  sale_price?: number | null;
  initial_quantity?: number;
  category_id?: string | null;
  supplier_id?: string | null;
  image_url?: string | null;
  track_lot?: boolean;
  track_expiry?: boolean;
  min_quantity?: number;
  lot_code?: string | null;
  expiry_date?: string | null;
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
      category_id: data.category_id ?? null,
      supplier_id: data.supplier_id ?? null,
      image_url: data.image_url ?? null,
      track_lot: data.track_lot ?? false,
      track_expiry: data.track_expiry ?? false,
      min_quantity: data.min_quantity ?? 0,
      expiry_tracked: data.track_expiry ?? false,
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
    if (data.track_lot && data.lot_code) {
      await ctx.supabase.from("stock_lots").insert({
        clinic_id: ctx.clinicId,
        product_id: product.id,
        lot_code: data.lot_code,
        expiry_date: data.expiry_date ?? null,
        quantity_on_hand: qty,
      });
    }
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
    supplier_id: string | null;
    image_url: string | null;
    min_quantity: number;
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
