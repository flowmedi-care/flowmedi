"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { calculatePaymentFee } from "@/lib/payment-fees";

export type BankAccountRow = {
  id: string;
  name: string;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
  is_default: boolean;
  active: boolean;
};

export type PaymentFeeRuleRow = {
  id: string;
  payment_method: string;
  card_brand: string | null;
  installments: number;
  fee_percent: number;
};

async function getClinicContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", supabase, profile: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", supabase, profile: null };
  }
  return { error: null, supabase, profile };
}

export async function listBankAccounts() {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as BankAccountRow[] };

  const { data, error } = await ctx.supabase
    .from("bank_accounts")
    .select("id, name, bank_name, agency, account_number, is_default, active")
    .eq("clinic_id", ctx.profile.clinic_id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    if (error.message.includes("bank_accounts")) {
      return { error: "Migration operational-flow-extensions não aplicada.", data: [] };
    }
    return { error: error.message, data: [] };
  }

  return {
    error: null,
    data: (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      bank_name: r.bank_name != null ? String(r.bank_name) : null,
      agency: r.agency != null ? String(r.agency) : null,
      account_number: r.account_number != null ? String(r.account_number) : null,
      is_default: Boolean(r.is_default),
      active: Boolean(r.active),
    })),
  };
}

export async function upsertBankAccount(input: {
  id?: string;
  name: string;
  bank_name?: string;
  agency?: string;
  account_number?: string;
  is_default?: boolean;
}) {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error };

  const row = {
    clinic_id: ctx.profile.clinic_id,
    name: input.name.trim(),
    bank_name: input.bank_name?.trim() || null,
    agency: input.agency?.trim() || null,
    account_number: input.account_number?.trim() || null,
    is_default: input.is_default ?? false,
    updated_at: new Date().toISOString(),
  };

  if (input.is_default) {
    await ctx.supabase
      .from("bank_accounts")
      .update({ is_default: false })
      .eq("clinic_id", ctx.profile.clinic_id);
  }

  if (input.id) {
    const { error } = await ctx.supabase.from("bank_accounts").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("bank_accounts").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/configuracoes/contas-bancarias");
  return { error: null };
}

export async function listPaymentFeeRules() {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: [] as PaymentFeeRuleRow[] };

  const { data, error } = await ctx.supabase
    .from("payment_fee_rules")
    .select("id, payment_method, card_brand, installments, fee_percent")
    .eq("clinic_id", ctx.profile.clinic_id)
    .eq("active", true)
    .order("installments");

  if (error) return { error: error.message, data: [] };

  return {
    error: null,
    data: (data ?? []).map((r) => ({
      id: String(r.id),
      payment_method: String(r.payment_method),
      card_brand: r.card_brand != null ? String(r.card_brand) : null,
      installments: Number(r.installments),
      fee_percent: Number(r.fee_percent),
    })),
  };
}

export async function upsertPaymentFeeRule(input: {
  id?: string;
  payment_method?: string;
  card_brand?: string | null;
  installments: number;
  fee_percent: number;
}) {
  const ctx = await getClinicContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error };

  const row = {
    clinic_id: ctx.profile.clinic_id,
    payment_method: input.payment_method ?? "cartao",
    card_brand: input.card_brand?.trim() || null,
    installments: input.installments,
    fee_percent: input.fee_percent,
  };

  if (input.id) {
    const { error } = await ctx.supabase.from("payment_fee_rules").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("payment_fee_rules").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/configuracoes/contas-bancarias");
  return { error: null };
}

export async function resolvePaymentFee(
  clinicId: string,
  paymentMethod: string,
  grossAmount: number,
  options?: { card_brand?: string | null; installments?: number }
) {
  const supabase = await createClient();
  const method = paymentMethod === "credit" || paymentMethod === "debit" ? "cartao" : paymentMethod;
  if (method !== "cartao") {
    return { feePercent: 0, ...calculatePaymentFee(grossAmount, 0) };
  }

  const installments = options?.installments ?? 1;
  const brand = options?.card_brand?.trim() || null;

  async function lookupFee(cardBrand: string | null) {
    let query = supabase
      .from("payment_fee_rules")
      .select("fee_percent")
      .eq("clinic_id", clinicId)
      .eq("payment_method", "cartao")
      .eq("installments", installments)
      .eq("active", true);
    if (cardBrand) {
      query = query.eq("card_brand", cardBrand);
    } else {
      query = query.is("card_brand", null);
    }
    const { data: rules } = await query.limit(1);
    return rules?.[0] ? Number(rules[0].fee_percent) : null;
  }

  let feePercent = brand ? await lookupFee(brand) : null;
  if (feePercent == null && brand) {
    feePercent = await lookupFee(null);
  }
  if (feePercent == null) {
    feePercent = 0;
    console.warn(
      `[resolvePaymentFee] Taxa não configurada — clinic=${clinicId} brand=${brand ?? "any"} installments=${installments}; fee=0`
    );
  }

  return { feePercent, ...calculatePaymentFee(grossAmount, feePercent) };
}
