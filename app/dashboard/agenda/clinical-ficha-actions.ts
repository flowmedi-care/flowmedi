"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { provisionAppointmentFichas } from "@/lib/clinical-fichas-provision";
import type { AppointmentFichaInstance, AppointmentFichaSummary, ClinicalFichaTemplate } from "@/lib/clinical-ficha-types";
import type { FormFieldDefinition } from "@/lib/form-types";
import { finishClinicalEncounter } from "./encounter-actions";

function mapTemplate(row: Record<string, unknown>): ClinicalFichaTemplate {
  const def = row.definition;
  return {
    id: String(row.id),
    clinic_id: String(row.clinic_id),
    name: String(row.name),
    slug: String(row.slug),
    ficha_type: row.ficha_type as ClinicalFichaTemplate["ficha_type"],
    definition: (Array.isArray(def) ? def : []) as FormFieldDefinition[],
    display_order: Number(row.display_order),
    is_system: Boolean(row.is_system),
    active: Boolean(row.active),
  };
}

export async function ensureAppointmentFichas(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as AppointmentFichaInstance[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, procedure:procedures!procedure_id ( id, name )")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!appt) return { error: "Consulta não encontrada.", data: [] };

  const legacyProc = Array.isArray(appt.procedure) ? appt.procedure[0] : appt.procedure;
  await provisionAppointmentFichas(supabase, profile.clinic_id, appointmentId, legacyProc, user.id);

  return getAppointmentFichas(appointmentId);
}

export async function getAppointmentFichas(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as AppointmentFichaInstance[] };

  const { data: rows, error } = await supabase
    .from("appointment_ficha_instances")
    .select(
      `
      id,
      appointment_id,
      ficha_template_id,
      responses,
      status,
      filled_by,
      updated_at,
      clinical_ficha_templates (
        id, clinic_id, name, slug, ficha_type, definition, display_order, is_system, active
      )
    `
    )
    .eq("appointment_id", appointmentId)
    .order("updated_at", { ascending: true });

  if (error) {
    if (error.message.includes("does not exist")) {
      return { error: null, data: [] };
    }
    return { error: error.message, data: [] };
  }

  const data: AppointmentFichaInstance[] = (rows ?? [])
    .map((row: Record<string, unknown>) => {
      const tplRaw = row.clinical_ficha_templates;
      const tpl = Array.isArray(tplRaw) ? tplRaw[0] : tplRaw;
      if (!tpl) return null;
      return {
        id: String(row.id),
        appointment_id: String(row.appointment_id),
        ficha_template_id: String(row.ficha_template_id),
        responses: (row.responses as Record<string, unknown>) ?? {},
        status: row.status as "rascunho" | "concluida",
        filled_by: row.filled_by != null ? String(row.filled_by) : null,
        updated_at: String(row.updated_at),
        template: mapTemplate(tpl as Record<string, unknown>),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        (a as AppointmentFichaInstance).template.display_order -
        (b as AppointmentFichaInstance).template.display_order
    ) as AppointmentFichaInstance[];

  return { error: null, data };
}

export async function saveFichaResponses(
  instanceId: string,
  responses: Record<string, unknown>,
  markComplete?: boolean
) {
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

  if (
    !profile?.clinic_id ||
    !["admin", "secretaria", "medico"].includes(profile.role ?? "")
  ) {
    return { error: "Sem permissão para preencher ficha." };
  }

  const { data: inst } = await supabase
    .from("appointment_ficha_instances")
    .select("appointment_id, status")
    .eq("id", instanceId)
    .single();

  if (!inst) return { error: "Ficha não encontrada." };

  const { data: updated, error } = await supabase
    .from("appointment_ficha_instances")
    .update({
      responses,
      status: markComplete ? "concluida" : "rascunho",
      filled_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) {
    return {
      error:
        "Não foi possível salvar a ficha. Verifique se a migration clinical-fichas foi aplicada e suas permissões.",
    };
  }

  return { error: null };
}

export async function finalizeClinicalEncounter(appointmentId: string) {
  return finishClinicalEncounter(appointmentId);
}

export async function getPatientFichasSummary(patientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as AppointmentFichaSummary[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, scheduled_at")
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .order("scheduled_at", { ascending: false })
    .limit(50);

  const apptIds = (appts ?? []).map((a) => a.id);
  if (apptIds.length === 0) return { error: null, data: [] };

  const { data: rows, error } = await supabase
    .from("appointment_ficha_instances")
    .select(
      `
      id,
      appointment_id,
      status,
      updated_at,
      clinical_ficha_templates ( name, ficha_type )
    `
    )
    .in("appointment_id", apptIds)
    .eq("status", "concluida");

  if (error) {
    if (error.message.includes("does not exist")) return { error: null, data: [] };
    return { error: error.message, data: [] };
  }

  const scheduledByAppt = new Map(
    (appts ?? []).map((a) => [a.id, a.scheduled_at as string])
  );

  const data: AppointmentFichaSummary[] = (rows ?? []).map((row: Record<string, unknown>) => {
    const tpl = Array.isArray(row.clinical_ficha_templates)
      ? row.clinical_ficha_templates[0]
      : row.clinical_ficha_templates;
    const apptId = String(row.appointment_id);
    return {
      instance_id: String(row.id),
      ficha_name: String((tpl as { name?: string })?.name ?? "Ficha"),
      ficha_type: (tpl as { ficha_type?: string })?.ficha_type as AppointmentFichaSummary["ficha_type"],
      status: String(row.status),
      updated_at: String(row.updated_at),
      appointment_id: apptId,
      scheduled_at: scheduledByAppt.get(apptId) ?? "",
    };
  });

  return { error: null, data };
}
