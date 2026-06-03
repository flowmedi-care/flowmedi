"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ClinicalFichaType } from "@/lib/clinical-ficha-types";
import type { FormFieldDefinition } from "@/lib/form-types";

export type ClinicalFichaTemplateRow = {
  id: string;
  name: string;
  slug: string;
  ficha_type: ClinicalFichaType;
  definition: FormFieldDefinition[];
  display_order: number;
  is_system: boolean;
  active: boolean;
};

export async function listClinicalFichaTemplates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as ClinicalFichaTemplateRow[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Sem permissão.", data: [] };
  }

  const { data, error } = await supabase
    .from("clinical_ficha_templates")
    .select("id, name, slug, ficha_type, definition, display_order, is_system, active")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order");

  if (error) {
    if (error.message.includes("does not exist")) {
      return { error: "Execute a migration clinical-fichas no Supabase.", data: [] };
    }
    return { error: error.message, data: [] };
  }

  return {
    error: null,
    data: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      ficha_type: r.ficha_type as ClinicalFichaType,
      definition: (Array.isArray(r.definition) ? r.definition : []) as FormFieldDefinition[],
      display_order: Number(r.display_order),
      is_system: Boolean(r.is_system),
      active: Boolean(r.active),
    })),
  };
}

export async function createClinicalFichaTemplate(data: {
  name: string;
  ficha_type: ClinicalFichaType;
  definition?: FormFieldDefinition[];
  display_order?: number;
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
  if (!profile?.clinic_id || profile.role !== "admin") return { error: "Sem permissão." };

  const slug = data.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { error } = await supabase.from("clinical_ficha_templates").insert({
    clinic_id: profile.clinic_id,
    name: data.name.trim(),
    slug: slug || `ficha-${Date.now()}`,
    ficha_type: data.ficha_type,
    definition: data.definition ?? [],
    display_order: data.display_order ?? 99,
    is_system: false,
    active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function updateClinicalFichaTemplate(
  id: string,
  data: {
    name?: string;
    definition?: FormFieldDefinition[];
    display_order?: number;
    active?: boolean;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("clinical_ficha_templates")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}

export async function getProcedureClinicalFichaIds(procedureId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("procedure_clinical_fichas")
    .select("ficha_template_id, sort_order")
    .eq("procedure_id", procedureId)
    .order("sort_order");

  if (error) return { error: error.message, data: [] as string[] };
  return {
    error: null,
    data: (data ?? []).map((r) => String(r.ficha_template_id)),
  };
}

export async function syncProcedureClinicalFichas(procedureId: string, fichaTemplateIds: string[]) {
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
  if (!profile?.clinic_id || profile.role !== "admin") return { error: "Sem permissão." };

  const { error: delErr } = await supabase
    .from("procedure_clinical_fichas")
    .delete()
    .eq("procedure_id", procedureId);
  if (delErr) return { error: delErr.message };

  if (fichaTemplateIds.length > 0) {
    const rows = fichaTemplateIds.map((fid, i) => ({
      procedure_id: procedureId,
      ficha_template_id: fid,
      sort_order: i,
    }));
    const { error: insErr } = await supabase.from("procedure_clinical_fichas").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/dashboard/campos-pacientes");
  return { error: null };
}
