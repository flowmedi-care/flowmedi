"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAdminClinic() {
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

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores.", supabase, clinicId: null };
  }

  return { error: null, supabase, clinicId: profile.clinic_id as string };
}

export async function updateQuoteAiSettings(input: {
  quoteDefaultValidityDays: number | null;
  quoteDefaultTerms: string | null;
}) {
  const ctx = await getAdminClinic();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error };

  if (
    input.quoteDefaultValidityDays !== null &&
    (input.quoteDefaultValidityDays < 1 || input.quoteDefaultValidityDays > 90)
  ) {
    return { error: "Validade deve ser entre 1 e 90 dias." };
  }

  const { error } = await ctx.supabase
    .from("clinics")
    .update({
      quote_default_validity_days: input.quoteDefaultValidityDays ?? 15,
      quote_default_terms: input.quoteDefaultTerms?.trim() || null,
    })
    .eq("id", ctx.clinicId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/vendas/orcamentos");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export type ProcedureQuoteSettingRow = {
  procedure_id: string;
  procedure_name: string;
  pricing_mode: "clinic_general" | "per_doctor";
  default_service_id: string | null;
  default_professional_id: string | null;
};

export async function listProcedureQuoteSettings(): Promise<{
  data: ProcedureQuoteSettingRow[] | null;
  error: string | null;
  quoteDefaultValidityDays: number;
  quoteDefaultTerms: string | null;
}> {
  const ctx = await getAdminClinic();
  if (ctx.error || !ctx.clinicId) {
    return { data: null, error: ctx.error, quoteDefaultValidityDays: 15, quoteDefaultTerms: null };
  }

  const [{ data: clinic }, { data: procedures }, { data: settings }] = await Promise.all([
    ctx.supabase
      .from("clinics")
      .select("quote_default_validity_days, quote_default_terms")
      .eq("id", ctx.clinicId)
      .single(),
    ctx.supabase
      .from("procedures")
      .select("id, name")
      .eq("clinic_id", ctx.clinicId)
      .order("display_order"),
    ctx.supabase
      .from("procedure_quote_settings")
      .select("procedure_id, pricing_mode, default_service_id, default_professional_id")
      .eq("clinic_id", ctx.clinicId),
  ]);

  const settingsMap = new Map(
    (settings ?? []).map((s) => [String(s.procedure_id), s])
  );

  const rows: ProcedureQuoteSettingRow[] = (procedures ?? []).map((p) => {
    const s = settingsMap.get(String(p.id));
    return {
      procedure_id: String(p.id),
      procedure_name: String(p.name),
      pricing_mode: (s?.pricing_mode as "clinic_general" | "per_doctor") ?? "per_doctor",
      default_service_id: s?.default_service_id ? String(s.default_service_id) : null,
      default_professional_id: s?.default_professional_id
        ? String(s.default_professional_id)
        : null,
    };
  });

  return {
    data: rows,
    error: null,
    quoteDefaultValidityDays: Number(clinic?.quote_default_validity_days) || 15,
    quoteDefaultTerms: clinic?.quote_default_terms ? String(clinic.quote_default_terms) : null,
  };
}

export async function upsertProcedureQuoteSetting(input: {
  procedureId: string;
  pricingMode: "clinic_general" | "per_doctor";
  defaultServiceId?: string | null;
  defaultProfessionalId?: string | null;
}) {
  const ctx = await getAdminClinic();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error };

  const { error } = await ctx.supabase.from("procedure_quote_settings").upsert(
    {
      clinic_id: ctx.clinicId,
      procedure_id: input.procedureId,
      pricing_mode: input.pricingMode,
      default_service_id: input.defaultServiceId || null,
      default_professional_id: input.defaultProfessionalId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,procedure_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/vendas/orcamentos");
  return { error: null };
}
