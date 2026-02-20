import { createClient } from "@/lib/supabase/server";
import type { PlanLimits } from "./plan-gates";

export interface ClinicPlanData {
  planId: string | null;
  planSlug: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  limits: PlanLimits;
}

/**
 * Busca dados do plano da clínica do usuário atual
 */
export async function getClinicPlanData(): Promise<ClinicPlanData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return null;

  // Buscar clínica (colunas opcionais: max_*_custom podem não existir em projetos antigos)
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("plan_id, subscription_status, max_doctors_custom, max_secretaries_custom")
    .eq("id", profile.clinic_id)
    .single();

  if (clinicError || !clinic) {
    // Fallback: assumir Pro (recursos ilimitados) para não bloquear operações
    return {
      planId: null,
      planSlug: "pro",
      planName: "Profissional",
      subscriptionStatus: "active",
      limits: {
        max_doctors: null,
        max_secretaries: null,
        max_appointments_per_month: null,
        max_patients: null,
        max_form_templates: null,
        max_custom_fields: null,
        storage_mb: null,
        whatsapp_enabled: true,
        email_enabled: true,
        custom_logo_enabled: true,
        priority_support: true,
      },
    };
  }

  const planId = clinic.plan_id;

  // Se não tem plano, assumir Starter (padrão)
  if (!planId) {
    const { data: starterPlan } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", "starter")
      .single();

    if (!starterPlan) {
      // Fallback com valores padrão do Starter
      return {
        planId: null,
        planSlug: "starter",
        planName: "Starter",
        subscriptionStatus: null,
        limits: {
          // Aplicar limites customizados se existirem, senão usar valores padrão
          max_doctors: clinic?.max_doctors_custom ?? 1,
          max_secretaries: clinic?.max_secretaries_custom ?? null,
          max_appointments_per_month: 30,
          max_patients: null,
          max_form_templates: 5,
          max_custom_fields: null,
          storage_mb: 500,
          whatsapp_enabled: false,
          email_enabled: false,
          custom_logo_enabled: false,
          priority_support: false,
        },
      };
    }

    return {
      planId: starterPlan.id,
      planSlug: starterPlan.slug,
      planName: starterPlan.name,
      subscriptionStatus: null,
      limits: {
        // Aplicar limites customizados se existirem, senão usar do plano
        max_doctors: clinic?.max_doctors_custom ?? starterPlan.max_doctors ?? null,
        max_secretaries: clinic?.max_secretaries_custom ?? starterPlan.max_secretaries ?? null,
        max_appointments_per_month: starterPlan.max_appointments_per_month ?? null,
        max_patients: starterPlan.max_patients ?? null,
        max_form_templates: starterPlan.max_form_templates ?? null,
        max_custom_fields: starterPlan.max_custom_fields ?? null,
        storage_mb: starterPlan.storage_mb ?? null,
        whatsapp_enabled: starterPlan.whatsapp_enabled ?? false,
        email_enabled: starterPlan.email_enabled ?? false,
        custom_logo_enabled: starterPlan.custom_logo_enabled ?? false,
        priority_support: starterPlan.priority_support ?? false,
      },
    };
  }

  // Buscar dados do plano
  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (!plan) {
    // Fallback para Starter se plano não encontrado
    const { data: starterPlan } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", "starter")
      .single();

    if (!starterPlan) {
      // Tabela plans vazia ou inacessível: assumir Pro para não bloquear
      return {
        planId: null,
        planSlug: "pro",
        planName: "Profissional",
        subscriptionStatus: clinic.subscription_status ?? "active",
        limits: {
          max_doctors: (clinic as Record<string, unknown>).max_doctors_custom ?? null,
          max_secretaries: (clinic as Record<string, unknown>).max_secretaries_custom ?? null,
          max_appointments_per_month: null,
          max_patients: null,
          max_form_templates: null,
          max_custom_fields: null,
          storage_mb: null,
          whatsapp_enabled: true,
          email_enabled: true,
          custom_logo_enabled: true,
          priority_support: true,
        },
      };
    }

    return {
      planId: starterPlan.id,
      planSlug: starterPlan.slug,
      planName: starterPlan.name,
      subscriptionStatus: clinic.subscription_status,
      limits: {
        // Aplicar limites customizados se existirem, senão usar do plano
        max_doctors: clinic.max_doctors_custom ?? starterPlan.max_doctors ?? null,
        max_secretaries: clinic.max_secretaries_custom ?? starterPlan.max_secretaries ?? null,
        max_appointments_per_month: starterPlan.max_appointments_per_month ?? null,
        max_patients: starterPlan.max_patients ?? null,
        max_form_templates: starterPlan.max_form_templates ?? null,
        max_custom_fields: starterPlan.max_custom_fields ?? null,
        storage_mb: starterPlan.storage_mb ?? null,
        whatsapp_enabled: starterPlan.whatsapp_enabled ?? false,
        email_enabled: starterPlan.email_enabled ?? false,
        custom_logo_enabled: starterPlan.custom_logo_enabled ?? false,
        priority_support: starterPlan.priority_support ?? false,
      },
    };
  }

  return {
    planId: plan.id,
    planSlug: plan.slug,
    planName: plan.name,
    subscriptionStatus: clinic.subscription_status,
    limits: {
      // Aplicar limites customizados se existirem, senão usar do plano
      max_doctors: clinic.max_doctors_custom ?? plan.max_doctors ?? null,
      max_secretaries: clinic.max_secretaries_custom ?? plan.max_secretaries ?? null,
      max_appointments_per_month: plan.max_appointments_per_month ?? null,
      max_patients: plan.max_patients ?? null,
      max_form_templates: plan.max_form_templates ?? null,
      max_custom_fields: plan.max_custom_fields ?? null,
      storage_mb: plan.storage_mb ?? null,
      whatsapp_enabled: plan.whatsapp_enabled ?? false,
      email_enabled: plan.email_enabled ?? false,
      custom_logo_enabled: plan.custom_logo_enabled ?? false,
      priority_support: plan.priority_support ?? false,
    },
  };
}

/**
 * Conta médicos ativos da clínica
 */
export async function countDoctors(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .eq("active", true);

  return count ?? 0;
}

/**
 * Conta secretários ativos da clínica
 */
export async function countSecretaries(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("role", "secretaria")
    .eq("active", true);

  return count ?? 0;
}

/**
 * Conta TODAS as consultas criadas no mês atual da clínica
 * (incluindo as que foram deletadas - conta por created_at)
 */
export async function countMonthAppointments(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Contar por created_at (todas criadas no mês, mesmo se deletadas depois)
  const { count } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString());

  return count ?? 0;
}

/**
 * Conta TODOS os pacientes criados no mês atual da clínica
 * (incluindo os que foram deletados - conta por created_at)
 */
export async function countMonthPatients(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Contar por created_at (todos criados no mês, mesmo se deletados depois)
  const { count } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", startOfMonth.toISOString())
    .lte("created_at", endOfMonth.toISOString());

  return count ?? 0;
}

/**
 * Conta templates de formulários da clínica
 */
export async function countFormTemplates(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("form_templates")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  return count ?? 0;
}

/**
 * Conta campos customizados da clínica
 */
export async function countCustomFields(clinicId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("patient_custom_fields")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  return count ?? 0;
}
