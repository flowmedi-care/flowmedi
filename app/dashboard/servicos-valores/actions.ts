"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getClinicAndRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin" && profile.role !== "medico")
    return { error: "Acesso negado. Apenas admin e médico." };
  const { data: clinic } = await supabase
    .from("clinics")
    .select("services_pricing_mode")
    .eq("id", profile.clinic_id)
    .single();
  const servicesPricingMode =
    clinic?.services_pricing_mode === "centralizado" ? "centralizado" : "descentralizado";
  if (servicesPricingMode === "centralizado" && profile.role === "medico") {
    return { error: "Modo centralizado ativo. Apenas administradores podem gerenciar serviços e valores." };
  }
  return { supabase, clinicId: profile.clinic_id, userId: user.id, role: profile.role };
}

import type { ServiceRecurrenceBillingMode } from "@/lib/recurrence-billing";

function normalizeRecurrenceBillingMode(
  mode: string | null | undefined
): ServiceRecurrenceBillingMode {
  if (mode === "per_session" || mode === "treatment_plan") return mode;
  return null;
}

// ——— Serviços ———
export async function createService(
  nome: string,
  categoria: string,
  recurrenceBillingMode?: ServiceRecurrenceBillingMode
) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("services").insert({
    clinic_id: ctx.clinicId,
    nome: nome.trim(),
    categoria: categoria.trim() || null,
    recurrence_billing_mode: normalizeRecurrenceBillingMode(recurrenceBillingMode),
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  revalidatePath("/dashboard/campos-pacientes");
  return { ok: true };
}

export async function updateService(
  id: string,
  nome: string,
  categoria: string,
  recurrenceBillingMode?: ServiceRecurrenceBillingMode
) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("services")
    .update({
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      recurrence_billing_mode: normalizeRecurrenceBillingMode(recurrenceBillingMode),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  revalidatePath("/dashboard/campos-pacientes");
  return { ok: true };
}

// RECORRÊNCIA v1 — Modo de cobrança da série definido no serviço.
export async function getServiceRecurrenceBilling(serviceId: string): Promise<{
  error: string | null;
  mode: ServiceRecurrenceBillingMode;
  serviceName: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", mode: null, serviceName: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada.", mode: null, serviceName: null };
  }

  const { data, error } = await supabase
    .from("services")
    .select("nome, recurrence_billing_mode")
    .eq("id", serviceId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("recurrence_billing_mode")) {
      return {
        error: "Migration migration-service-recurrence-billing não aplicada.",
        mode: null,
        serviceName: null,
      };
    }
    return { error: error.message, mode: null, serviceName: null };
  }
  if (!data) return { error: "Serviço não encontrado.", mode: null, serviceName: null };

  return {
    error: null,
    mode: normalizeRecurrenceBillingMode(data.recurrence_billing_mode as string | null),
    serviceName: data.nome != null ? String(data.nome) : null,
  };
}

export async function deleteService(id: string) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("services").delete().eq("id", id).eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

// ——— Dimensões ———
export async function createDimension(nome: string) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("price_dimensions").insert({
    clinic_id: ctx.clinicId,
    nome: nome.trim(),
    ativo: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

export async function updateDimension(id: string, nome: string, ativo: boolean) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("price_dimensions")
    .update({ nome: nome.trim(), ativo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

export async function deleteDimension(id: string) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("price_dimensions").delete().eq("id", id).eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

// ——— Valores das dimensões ———
export async function createDimensionValue(dimensionId: string, nome: string, cor?: string | null) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const hex = cor?.trim() && /^#[0-9A-Fa-f]{6}$/.test(cor.trim()) ? cor.trim() : null;
  const { error } = await ctx.supabase.from("dimension_values").insert({
    clinic_id: ctx.clinicId,
    dimension_id: dimensionId,
    nome: nome.trim(),
    ativo: true,
    cor: hex,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

export async function updateDimensionValue(id: string, nome: string, ativo: boolean, cor?: string | null) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const hex = cor?.trim() && /^#[0-9A-Fa-f]{6}$/.test(cor.trim()) ? cor.trim() : null;
  const { error } = await ctx.supabase
    .from("dimension_values")
    .update({ nome: nome.trim(), ativo, cor: hex, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

export async function deleteDimensionValue(id: string) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("dimension_values").delete().eq("id", id).eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

// ——— Regras de preço ———
export async function createServicePrice(
  serviceId: string,
  professionalId: string | null,
  valor: number,
  dimensionValueIds: string[]
) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  const effectiveProfessionalId = ctx.role === "medico" ? ctx.userId : (professionalId || null);
  const { data: row, error: insertErr } = await ctx.supabase
    .from("service_prices")
    .insert({
      clinic_id: ctx.clinicId,
      service_id: serviceId,
      professional_id: effectiveProfessionalId,
      valor,
      ativo: true,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };
  if (!row?.id) return { error: "Erro ao criar regra." };
  if (dimensionValueIds.length > 0) {
    const { error: pivotErr } = await ctx.supabase.from("price_rule_dimension_values").insert(
      dimensionValueIds.map((dimension_value_id) => ({ service_price_id: row.id, dimension_value_id }))
    );
    if (pivotErr) return { error: pivotErr.message };
  }
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

export async function updateServicePrice(
  id: string,
  serviceId: string,
  professionalId: string | null,
  valor: number,
  ativo: boolean,
  dimensionValueIds: string[]
) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.role === "medico") {
    const { data: existing } = await ctx.supabase
      .from("service_prices")
      .select("professional_id")
      .eq("id", id)
      .eq("clinic_id", ctx.clinicId)
      .single();
    if (!existing || existing.professional_id !== ctx.userId)
      return { error: "Você só pode editar suas próprias regras de preço." };
  }
  const effectiveProfessionalId = ctx.role === "medico" ? ctx.userId : (professionalId || null);
  const { error: updateErr } = await ctx.supabase
    .from("service_prices")
    .update({
      service_id: serviceId,
      professional_id: effectiveProfessionalId,
      valor,
      ativo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", ctx.clinicId);
  if (updateErr) return { error: updateErr.message };
  await ctx.supabase.from("price_rule_dimension_values").delete().eq("service_price_id", id);
  if (dimensionValueIds.length > 0) {
    await ctx.supabase.from("price_rule_dimension_values").insert(
      dimensionValueIds.map((dimension_value_id) => ({ service_price_id: id, dimension_value_id }))
    );
  }
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}

export async function deleteServicePrice(id: string) {
  const ctx = await getClinicAndRole();
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.role === "medico") {
    const { data: existing } = await ctx.supabase
      .from("service_prices")
      .select("professional_id")
      .eq("id", id)
      .eq("clinic_id", ctx.clinicId)
      .single();
    if (!existing || existing.professional_id !== ctx.userId)
      return { error: "Você só pode excluir suas próprias regras de preço." };
  }
  const { error } = await ctx.supabase.from("service_prices").delete().eq("id", id).eq("clinic_id", ctx.clinicId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicos-valores");
  revalidatePath("/dashboard/servicos-valores/servicos");
  revalidatePath("/dashboard/servicos-valores/procedimentos");
  return { ok: true };
}
