"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const DEFAULT_MESSAGE = "Olá gostaria de obter mais informação sobre a consulta com o dr [seu nome]";

export async function getReferralLinkData(): Promise<{
  referralLink: string | null;
  customMessage: string | null;
  whatsappUrl: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { referralLink: null, customMessage: null, whatsappUrl: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico")
    return { referralLink: null, customMessage: null, whatsappUrl: null, error: "Apenas médicos podem usar o link de divulgação." };

  const clinicId = profile.clinic_id as string | null;
  if (!clinicId)
    return { referralLink: null, customMessage: null, whatsappUrl: null, error: "Clínica não vinculada." };

  // Usar service role para garantir leitura do clinic (evita bloqueio por RLS)
  const serviceSupabase = createServiceRoleClient();
  const { data: clinic } = await serviceSupabase
    .from("clinics")
    .select("whatsapp_url, phone")
    .eq("id", clinicId)
    .single();

  let whatsappUrl = (clinic?.whatsapp_url as string | null) ?? null;
  if (!whatsappUrl?.trim()) {
    const phone = (clinic?.phone as string | null) ?? null;
    if (phone?.trim()) {
      const digits = phone.replace(/\D/g, "");
      const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
      if (withCountry.length >= 12) {
        whatsappUrl = `https://wa.me/${withCountry}`;
      }
    }
  }

  const { data: referralRow } = await supabase
    .from("doctor_referral_codes")
    .select("custom_message")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", profile.id)
    .maybeSingle();

  const customMessage = referralRow ? (referralRow.custom_message as string) : null;

  let referralLink: string | null = null;
  if (whatsappUrl && customMessage && customMessage.trim().length >= 15) {
    const base = whatsappUrl.trim().replace(/\/$/, "");
    const sep = base.includes("?") ? "&" : "?";
    referralLink = `${base}${sep}text=${encodeURIComponent(customMessage.trim())}`;
  }

  return {
    referralLink,
    customMessage,
    whatsappUrl,
    error: null,
  };
}

export async function saveReferralMessage(customMessage: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico")
    return { error: "Apenas médicos podem configurar o link de divulgação." };

  const clinicId = profile.clinic_id as string | null;
  if (!clinicId) return { error: "Clínica não vinculada." };

  const trimmed = customMessage.trim();
  if (trimmed.length < 15) {
    return { error: "A mensagem deve ter pelo menos 15 caracteres. Inclua seu nome para garantir a vinculação correta." };
  }

  const serviceSupabase = createServiceRoleClient();
  const { error } = await serviceSupabase
    .from("doctor_referral_codes")
    .upsert(
      {
        clinic_id: clinicId,
        doctor_id: profile.id,
        custom_message: trimmed,
      },
      { onConflict: "clinic_id,doctor_id" }
    );

  if (error) return { error: error.message };
  return { error: null };
}

export { DEFAULT_MESSAGE };
