"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProductFieldDefinition = {
  id: string;
  slug: string;
  label: string;
  field_type: string;
  required_for_lot: boolean;
};

export type StockLotRow = {
  id: string;
  product_id: string;
  product_name: string;
  lot_code: string;
  expiry_date: string | null;
  quantity_on_hand: number;
};

export async function listProductFieldDefinitions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as ProductFieldDefinition[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data, error } = await supabase
    .from("product_field_definitions")
    .select("id, slug, label, field_type, required_for_lot")
    .eq("clinic_id", profile.clinic_id)
    .eq("active", true)
    .order("display_order");

  if (error) {
    if (error.message.includes("product_field_definitions")) {
      return { error: "Migration operational-flow-extensions não aplicada.", data: [] };
    }
    return { error: error.message, data: [] };
  }

  return {
    error: null,
    data: (data ?? []).map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.label),
      field_type: String(r.field_type),
      required_for_lot: Boolean(r.required_for_lot),
    })),
  };
}

export async function upsertProductFieldDefinition(input: {
  id?: string;
  slug: string;
  label: string;
  field_type?: "text" | "number" | "date" | "boolean";
  required_for_lot?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin") return { error: "Sem permissão." };

  const row = {
    clinic_id: profile.clinic_id,
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "_"),
    label: input.label.trim(),
    field_type: input.field_type ?? "text",
    required_for_lot: input.required_for_lot ?? false,
  };

  if (input.id) {
    const { error } = await supabase.from("product_field_definitions").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("product_field_definitions").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/estoque/campos-produto");
  return { error: null };
}

export async function listStockLots(productId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as StockLotRow[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  let query = supabase
    .from("stock_lots")
    .select("id, product_id, lot_code, expiry_date, quantity_on_hand, products(name)")
    .eq("clinic_id", profile.clinic_id)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("stock_lots")) {
      return { error: "Migration operational-flow-extensions não aplicada.", data: [] };
    }
    return { error: error.message, data: [] };
  }

  return {
    error: null,
    data: (data ?? []).map((r: Record<string, unknown>) => {
      const prod = Array.isArray(r.products) ? r.products[0] : r.products;
      return {
        id: String(r.id),
        product_id: String(r.product_id),
        product_name: (prod as { name?: string })?.name ?? "—",
        lot_code: String(r.lot_code),
        expiry_date: r.expiry_date != null ? String(r.expiry_date) : null,
        quantity_on_hand: Number(r.quantity_on_hand),
      };
    }),
  };
}

export async function upsertStockLot(input: {
  id?: string;
  product_id: string;
  lot_code: string;
  expiry_date?: string | null;
  quantity_on_hand: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão." };
  }

  const row = {
    clinic_id: profile.clinic_id,
    product_id: input.product_id,
    lot_code: input.lot_code.trim(),
    expiry_date: input.expiry_date || null,
    quantity_on_hand: input.quantity_on_hand,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("stock_lots").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("stock_lots").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/estoque/lotes");
  return { error: null };
}
