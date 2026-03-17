"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData, countCustomFields } from "@/lib/plan-helpers";
import { canCreateCustomField, getUpgradeMessage } from "@/lib/plan-gates";

export type CustomFieldInsert = {
  field_name: string;
  field_type: "text" | "number" | "date" | "textarea" | "select";
  field_label: string;
  required: boolean;
  options?: string[];
  display_order: number;
  include_in_public_form?: boolean;
};

export type CustomFieldUpdate = Partial<CustomFieldInsert>;

function normalizeFieldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function buildUniqueFieldName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  requestedName: string,
  fallbackLabel: string
): Promise<string> {
  const base = normalizeFieldName(requestedName || fallbackLabel || "campo");
  const safeBase = base || "campo";

  const { data: existing, error } = await supabase
    .from("patient_custom_fields")
    .select("field_name")
    .eq("clinic_id", clinicId)
    .ilike("field_name", `${safeBase}%`);

  if (error) return safeBase;

  const existingNames = new Set((existing ?? []).map((item) => item.field_name));
  if (!existingNames.has(safeBase)) return safeBase;

  let suffix = 2;
  while (existingNames.has(`${safeBase}_${suffix}`)) {
    suffix += 1;
  }
  return `${safeBase}_${suffix}`;
}

export async function createCustomField(data: CustomFieldInsert) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem criar campos." };
  }

  if (!profile.clinic_id) {
    return { error: "Clínica não encontrada." };
  }

  // Verificar limite de campos customizados
  const planData = await getClinicPlanData();
  if (planData) {
    const currentCount = await countCustomFields(profile.clinic_id);
    const check = canCreateCustomField(planData.limits, currentCount);
    
    if (!check.allowed) {
      const upgradeMsg = getUpgradeMessage("campos customizados");
      return { error: `${check.reason}. ${upgradeMsg}` };
    }
  }

  const uniqueFieldName = await buildUniqueFieldName(
    supabase,
    profile.clinic_id,
    data.field_name,
    data.field_label
  );

  const { error } = await supabase.from("patient_custom_fields").insert({
    clinic_id: profile.clinic_id,
    field_name: uniqueFieldName,
    field_type: data.field_type,
    field_label: data.field_label,
    required: data.required,
    options: data.options || null,
    display_order: data.display_order,
    include_in_public_form: data.include_in_public_form ?? false,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function updateCustomField(id: string, data: CustomFieldUpdate) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem editar campos." };
  }

  const { error } = await supabase
    .from("patient_custom_fields")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function deleteCustomField(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores podem excluir campos." };
  }

  const { error } = await supabase
    .from("patient_custom_fields")
    .delete()
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

// ========== PROCEDIMENTOS (ex.: endoscopia — nome + recomendações) ==========
export type ProcedureRow = {
  id: string;
  name: string;
  recommendations: string | null;
  display_order: number;
};

export async function listProcedures(): Promise<{ error: string | null; data: ProcedureRow[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data, error } = await supabase
    .from("procedures")
    .select("id, name, recommendations, display_order")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { error: null, data: (data ?? []).map((p) => ({ ...p, display_order: p.display_order ?? 0 })) };
}

export async function createProcedure(name: string, recommendations: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return { error: "Apenas administradores podem criar procedimentos." };
  if (!profile.clinic_id) return { error: "Clínica não encontrada." };

  const { data: maxOrder } = await supabase
    .from("procedures")
    .select("display_order")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const display_order = (maxOrder?.display_order ?? -1) + 1;

  const { data: inserted, error } = await supabase.from("procedures").insert({
    clinic_id: profile.clinic_id,
    name: name.trim(),
    recommendations: recommendations?.trim() || null,
    display_order,
  }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null, procedureId: inserted?.id };
}

export async function updateProcedure(
  id: string,
  data: { name: string; recommendations: string | null }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return { error: "Apenas administradores podem editar procedimentos." };

  const { error } = await supabase
    .from("procedures")
    .update({
      name: data.name.trim(),
      recommendations: data.recommendations?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function syncDoctorProcedures(procedureId: string, doctorIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return { error: "Apenas administradores podem editar procedimentos." };
  if (!profile.clinic_id) return { error: "Clínica não encontrada." };

  const { error: delErr } = await supabase
    .from("doctor_procedures")
    .delete()
    .eq("clinic_id", profile.clinic_id)
    .eq("procedure_id", procedureId);
  if (delErr) return { error: delErr.message };

  if (doctorIds.length > 0) {
    const toInsert = doctorIds.map((doctor_id) => ({
      clinic_id: profile.clinic_id,
      procedure_id: procedureId,
      doctor_id,
    }));
    const { error: insErr } = await supabase.from("doctor_procedures").insert(toInsert);
    if (insErr) return { error: insErr.message };
  }
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function deleteProcedure(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.clinic_id) {
    return { error: "Apenas administradores podem excluir procedimentos." };
  }

  const [{ count: appointmentsCount }, { count: templatesCount }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", profile.clinic_id)
      .eq("procedure_id", id),
    supabase
      .from("form_template_procedures")
      .select("procedure_id", { count: "exact", head: true })
      .eq("procedure_id", id),
  ]);

  const impacts: string[] = [];
  if ((appointmentsCount ?? 0) > 0) impacts.push(`${appointmentsCount} consulta(s)`);
  if ((templatesCount ?? 0) > 0) impacts.push(`${templatesCount} vínculo(s) com formulário`);
  if (impacts.length > 0) {
    return {
      error: `Não foi possível excluir este procedimento porque ele está em uso por ${impacts.join(" e ")}.`,
    };
  }

  const { error } = await supabase
    .from("procedures")
    .delete()
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}
