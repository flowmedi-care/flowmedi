"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormTemplateDefinition } from "@/lib/form-types";
import { getClinicPlanData, countFormTemplates } from "@/lib/plan-helpers";
import { canCreateFormTemplate, getUpgradeMessage } from "@/lib/plan-gates";

export async function createFormTemplate(
  name: string,
  definition: FormTemplateDefinition,
  appointmentTypeId: string | null,
  isPublic: boolean = false,
  publicDoctorId: string | null = null,
  procedureIds: string[] = []
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  // Verificar limite de templates de formulários
  const planData = await getClinicPlanData();
  if (planData) {
    const currentCount = await countFormTemplates(profile.clinic_id);
    const check = canCreateFormTemplate(planData.limits, currentCount);
    
    if (!check.allowed) {
      const upgradeMsg = getUpgradeMessage("formulários");
      return { error: `${check.reason}. ${upgradeMsg}` };
    }
  }

  const { data: inserted, error } = await supabase
    .from("form_templates")
    .insert({
      clinic_id: profile.clinic_id,
      name: name.trim(),
      definition: definition as unknown as Record<string, unknown>[],
      appointment_type_id: appointmentTypeId || null,
      is_public: isPublic,
      public_doctor_id: publicDoctorId || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (inserted?.id && procedureIds.length > 0) {
    await supabase.from("form_template_procedures").insert(
      procedureIds.map((procedure_id) => ({
        form_template_id: inserted.id,
        procedure_id,
      }))
    );
  }
  revalidatePath("/dashboard/formularios");
  return { error: null };
}

export async function updateFormTemplate(
  id: string,
  name: string,
  definition: FormTemplateDefinition,
  appointmentTypeId: string | null,
  isPublic: boolean = false,
  publicDoctorId: string | null = null,
  procedureIds: string[] = []
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .update({
      name: name.trim(),
      definition: definition as unknown as Record<string, unknown>[],
      appointment_type_id: appointmentTypeId || null,
      is_public: isPublic,
      public_doctor_id: publicDoctorId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("form_template_procedures").delete().eq("form_template_id", id);
  if (procedureIds.length > 0) {
    await supabase.from("form_template_procedures").insert(
      procedureIds.map((procedure_id) => ({
        form_template_id: id,
        procedure_id,
      }))
    );
  }
  revalidatePath("/dashboard/formularios");
  revalidatePath(`/dashboard/formularios/${id}`);
  return { error: null };
}

export async function deleteFormTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("form_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/formularios");
  return { error: null };
}

export type AppointmentOption = {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_name: string | null;
};

export async function getAppointmentsByPatient(patientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const fromToday = new Date();
  fromToday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      scheduled_at,
      status,
      doctor:profiles ( full_name )
    `)
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .gte("scheduled_at", fromToday.toISOString())
    .in("status", ["agendada", "confirmada"])
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) return { error: error.message, data: null };
  const list: AppointmentOption[] = (data ?? []).map((a: Record<string, unknown>) => {
    const doc = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    return {
      id: String(a.id),
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      doctor_name: (doc as { full_name?: string } | null)?.full_name ?? null,
    };
  });
  return { error: null, data: list };
}

import { generateUniqueFormSlug, generateUniqueSlugFromName, slugify } from "@/lib/form-slug";

function generateLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
}

function generatePublicLinkToken(): string {
  return "pub_" + crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
}

// Gera ou retorna link público de um formulário
export async function createOrGetPublicFormLink(
  formTemplateId: string
): Promise<{ error: string | null; link: string | null; isNew: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", link: null, isNew: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", link: null, isNew: false };

  // Buscar dados da clínica para obter o slug
  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name")
    .eq("id", profile.clinic_id)
    .single();

  // Verificar se o template permite uso público
  const { data: template } = await supabase
    .from("form_templates")
    .select("is_public, clinic_id, name")
    .eq("id", formTemplateId)
    .single();

  if (!template) return { error: "Template não encontrado.", link: null, isNew: false };
  if (template.clinic_id !== profile.clinic_id) {
    return { error: "Não autorizado.", link: null, isNew: false };
  }
  if (!template.is_public) {
    return { error: "Este formulário não permite uso público.", link: null, isNew: false };
  }

  // Gerar ou obter slug da clínica
  let clinicSlug = clinic?.slug;
  if (!clinicSlug) {
    // Se não tem slug, gerar um baseado no nome
    clinicSlug = slugify(clinic?.name || "clinica");
    // Atualizar no banco
    await supabase
      .from("clinics")
      .update({ slug: clinicSlug })
      .eq("id", profile.clinic_id);
  }

  // Gerar slug amigável baseado no nome do formulário
  const formSlug = slugify(template.name || "formulario");
  
  // O link público sempre aponta para o template, não para uma instância específica
  // A instância será criada quando a pessoa submeter o formulário
  return {
    error: null,
    link: `/f/public/${clinicSlug}/${formSlug}`,
    isNew: true,
  };
}

// Busca não-cadastrados (pessoas que preencheram formulários públicos)
export async function getNonRegisteredSubmitters() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  // Buscar emails de pacientes já cadastrados nesta clínica
  const { data: registeredPatients } = await supabase
    .from("patients")
    .select("email")
    .eq("clinic_id", profile.clinic_id)
    .not("email", "is", null);

  // Emails que não devem aparecer em não-cadastrados (ex.: foram cadastrados e depois excluídos)
  const { data: excludedRows } = await supabase
    .from("excluded_submitter_emails")
    .select("email")
    .eq("clinic_id", profile.clinic_id);

  // Criar Set com emails normalizados (lowercase, trimmed) para comparação rápida
  const registeredEmails = new Set<string>();
  (registeredPatients ?? []).forEach((p) => {
    if (p.email) {
      const normalized = p.email.toLowerCase().trim();
      if (normalized) {
        registeredEmails.add(normalized);
      }
    }
  });
  (excludedRows ?? []).forEach((r) => {
    if (r.email) {
      const normalized = r.email.toLowerCase().trim();
      if (normalized) registeredEmails.add(normalized);
    }
  });

  // Buscar instâncias públicas com dados do submissor
  const { data, error } = await supabase
    .from("form_instances")
    .select(`
      id,
      public_submitter_name,
      public_submitter_email,
      public_submitter_phone,
      public_submitter_birth_date,
      public_submitter_custom_fields,
      status,
      created_at,
      form_template_id,
      form_templates!inner (
        name,
        clinic_id
      )
    `)
    .is("appointment_id", null)
    .not("public_submitter_email", "is", null)
    .eq("form_templates.clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: null };

  // Agrupar por email (pode ter múltiplos formulários)
  const grouped = new Map<
    string,
    {
      email: string;
      name: string | null;
      phone: string | null;
      birth_date: string | null;
      custom_fields: Record<string, unknown>;
      forms: Array<{
        id: string;
        template_name: string;
        status: string;
        created_at: string;
      }>;
      latest_form_date: string;
    }
  >();

  (data ?? []).forEach((item: Record<string, unknown>) => {
    const email = String(item.public_submitter_email || "");
    if (!email) return;

    // Filtrar: se o email já está cadastrado como paciente, não incluir em não-cadastrados
    const emailLower = email.toLowerCase().trim();
    if (registeredEmails.has(emailLower)) {
      return; // Pular este item, já está cadastrado
    }

    const template = Array.isArray(item.form_templates)
      ? item.form_templates[0]
      : item.form_templates;
    const templateName = (template as { name?: string } | null)?.name || "Formulário";

    if (!grouped.has(email)) {
      grouped.set(email, {
        email,
        name: (item.public_submitter_name as string) || null,
        phone: (item.public_submitter_phone as string) || null,
        birth_date: (item.public_submitter_birth_date as string) || null,
        custom_fields: {},
        forms: [],
        latest_form_date: String(item.created_at || ""),
      });
    }

    const entry = grouped.get(email)!;
    entry.forms.push({
      id: String(item.id),
      template_name: templateName,
      status: String(item.status || "pendente"),
      created_at: String(item.created_at || ""),
    });

    // Combinar campos customizados de todas as instâncias
    if (item.public_submitter_custom_fields) {
      const customFields = item.public_submitter_custom_fields as Record<string, unknown>;
      Object.assign(entry.custom_fields, customFields);
    }

    // Atualizar data mais recente
    if (String(item.created_at || "") > entry.latest_form_date) {
      entry.latest_form_date = String(item.created_at || "");
    }
  });

  return {
    error: null,
    data: Array.from(grouped.values()),
  };
}

export async function ensureFormInstanceAndGetLink(
  appointmentId: string,
  formTemplateId: string
): Promise<{ error: string | null; link: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", link: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", link: null };

  // Buscar dados da clínica para obter o slug
  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name")
    .eq("id", profile.clinic_id)
    .single();

  // Buscar dados do template e do paciente para gerar slugs amigáveis
  const { data: appointment } = await supabase
    .from("appointments")
    .select(`
      patient:patients!inner(full_name)
    `)
    .eq("id", appointmentId)
    .single();

  const { data: template } = await supabase
    .from("form_templates")
    .select("name")
    .eq("id", formTemplateId)
    .single();

  // Gerar ou obter slug da clínica
  let clinicSlug = clinic?.slug;
  if (!clinicSlug) {
    // Se não tem slug, gerar um baseado no nome
    clinicSlug = slugify(clinic?.name || "clinica");
    // Atualizar no banco
    await supabase
      .from("clinics")
      .update({ slug: clinicSlug })
      .eq("id", profile.clinic_id);
  }

  const { data: existing } = await supabase
    .from("form_instances")
    .select("slug, link_token")
    .eq("appointment_id", appointmentId)
    .eq("form_template_id", formTemplateId)
    .maybeSingle();

  if (existing) {
    // Se já existe, retornar o link existente
    if (existing.slug) {
      return { error: null, link: `/f/${existing.slug}` };
    }
    // Fallback para link_token se slug não existir (compatibilidade)
    if (existing.link_token) {
      return { error: null, link: `/f/${existing.link_token}` };
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Gerar slugs amigáveis baseados em nomes
  const patient = Array.isArray(appointment?.patient) 
    ? appointment.patient[0] 
    : appointment?.patient;

  const formSlug = template?.name ? slugify(template.name) : "formulario";
  const patientSlug = patient?.full_name ? slugify(patient.full_name) : "paciente";
  
  // Criar slug composto incluindo clinic: {clinicSlug}/{formSlug}/{patientSlug}
  const combinedSlug = `${clinicSlug}/${formSlug}/${patientSlug}`;
  
  // Verificar se já existe algum slug similar e adicionar sufixo se necessário
  const { data: existingSlug } = await supabase
    .from("form_instances")
    .select("id")
    .eq("slug", combinedSlug)
    .maybeSingle();
  
  let finalSlug = combinedSlug;
  if (existingSlug) {
    // Se já existe, adicionar sufixo numérico
    for (let i = 1; i <= 10; i++) {
      const slugWithSuffix = `${combinedSlug}-${i}`;
      const { data: check } = await supabase
        .from("form_instances")
        .select("id")
        .eq("slug", slugWithSuffix)
        .maybeSingle();
      if (!check) {
        finalSlug = slugWithSuffix;
        break;
      }
    }
  }

  const linkToken = generateLinkToken();

  const { data: inserted, error } = await supabase
    .from("form_instances")
    .insert({
      appointment_id: appointmentId,
      form_template_id: formTemplateId,
      status: "pendente",
      link_token: linkToken,
      slug: finalSlug,
      link_expires_at: expiresAt.toISOString(),
      responses: {},
    })
    .select("slug, link_token")
    .single();

  if (error) return { error: error.message, link: null };
  // Usar slug amigável se disponível
  return {
    error: null,
    link: inserted?.slug ? `/f/${inserted.slug}` : (inserted?.link_token ? `/f/${inserted.link_token}` : null),
  };
}
