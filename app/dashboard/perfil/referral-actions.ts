"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/form-slug";

export async function getReferralLinkData(): Promise<{
  referralLink: string | null;
  referralCode: string | null;
  whatsappUrl: string | null;
  doctorName: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { referralLink: null, referralCode: null, whatsappUrl: null, doctorName: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico")
    return { referralLink: null, referralCode: null, whatsappUrl: null, doctorName: null, error: "Apenas médicos podem usar o link de divulgação." };

  const clinicId = profile.clinic_id as string | null;
  if (!clinicId)
    return { referralLink: null, referralCode: null, whatsappUrl: null, doctorName: profile.full_name as string | null, error: "Clínica não vinculada." };

  const { data: clinic } = await supabase
    .from("clinics")
    .select("whatsapp_url")
    .eq("id", clinicId)
    .single();

  const whatsappUrl = (clinic?.whatsapp_url as string | null) ?? null;

  const { data: referralRow } = await supabase
    .from("doctor_referral_codes")
    .select("code")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", profile.id)
    .maybeSingle();

  const referralCode = referralRow ? (referralRow.code as string) : null;

  let referralLink: string | null = null;
  if (whatsappUrl && referralCode) {
    const doctorName = (profile.full_name as string) || "Médico";
    const preFilledMessage = `Olá! O Dr(a). ${doctorName} me passou este contato. Gostaria de agendar. Código: ${referralCode}`;
    const base = whatsappUrl.trim().replace(/\/$/, "");
    const sep = base.includes("?") ? "&" : "?";
    referralLink = `${base}${sep}text=${encodeURIComponent(preFilledMessage)}`;
  }

  return {
    referralLink,
    referralCode,
    whatsappUrl,
    doctorName: profile.full_name as string | null,
    error: null,
  };
}

export async function generateReferralCode(): Promise<{ code: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { code: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "medico")
    return { code: null, error: "Apenas médicos podem gerar link de divulgação." };

  const clinicId = profile.clinic_id as string | null;
  if (!clinicId) return { code: null, error: "Clínica não vinculada." };

  const { data: existing } = await supabase
    .from("doctor_referral_codes")
    .select("code")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", profile.id)
    .maybeSingle();

  if (existing) {
    revalidatePath("/dashboard/perfil");
    return { code: existing.code as string, error: null };
  }

  const fullName = (profile.full_name as string) || "medico";
  let baseCode = slugify(fullName);
  if (!baseCode) baseCode = "dr";
  if (baseCode.length > 30) baseCode = baseCode.substring(0, 30);

  let code = baseCode;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const { error } = await supabase.from("doctor_referral_codes").insert({
      clinic_id: clinicId,
      doctor_id: profile.id,
      code,
    });

    if (!error) {
      revalidatePath("/dashboard/perfil");
      return { code, error: null };
    }

    if (error.code === "23505") {
      code = `${baseCode}-${Math.random().toString(36).slice(2, 6)}`;
      attempts++;
    } else {
      return { code: null, error: error.message };
    }
  }

  code = `${baseCode}-${Date.now().toString(36).slice(-4)}`;
  const { error } = await supabase.from("doctor_referral_codes").insert({
    clinic_id: clinicId,
    doctor_id: profile.id,
    code,
  });

  if (error) return { code: null, error: error.message };
  revalidatePath("/dashboard/perfil");
  return { code, error: null };
}
