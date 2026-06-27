"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { provisionAppointmentFichas } from "@/lib/clinical-fichas-provision";
import type {
  AppointmentFichaDetail,
  AppointmentFichaInstance,
  AppointmentFichaSummary,
  ClinicalFichaTemplate,
  CopyFichaResult,
  FichaCopySource,
  FichaHistoryAppointment,
} from "@/lib/clinical-ficha-types";
import type { FormFieldDefinition } from "@/lib/form-types";
import { finishClinicalEncounter } from "./encounter-actions";

const COPYABLE_FICHA_TYPES = new Set(["fields"]);

function hasFichaResponses(responses: Record<string, unknown>): boolean {
  return Object.values(responses).some((v) => {
    if (v == null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}

function mapFichaRow(row: Record<string, unknown>): AppointmentFichaInstance | null {
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
}

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
    .map((row: Record<string, unknown>) => mapFichaRow(row))
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

export async function getPatientFichaHistoryForAtendimento(
  patientId: string,
  currentAppointmentId: string
): Promise<{
  error: string | null;
  current: AppointmentFichaInstance[];
  previous: FichaHistoryAppointment[];
  copySources: FichaCopySource[];
}> {
  const empty = {
    error: null as string | null,
    current: [] as AppointmentFichaInstance[],
    previous: [] as FichaHistoryAppointment[],
    copySources: [] as FichaCopySource[],
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...empty, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { ...empty, error: "Clínica não encontrada." };

  const currentRes = await getAppointmentFichas(currentAppointmentId);
  if (currentRes.error) return { ...empty, error: currentRes.error };

  const { data: appts, error: apptErr } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      doctor:profiles!doctor_id ( full_name )
    `
    )
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .neq("id", currentAppointmentId)
    .order("scheduled_at", { ascending: false })
    .limit(20);

  if (apptErr) {
    if (apptErr.message.includes("does not exist")) {
      return { ...empty, current: currentRes.data };
    }
    return { ...empty, error: apptErr.message, current: currentRes.data };
  }

  const apptIds = (appts ?? []).map((a) => a.id);
  if (apptIds.length === 0) {
    return { ...empty, current: currentRes.data };
  }

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
    .in("appointment_id", apptIds);

  if (error) {
    if (error.message.includes("does not exist")) {
      return { ...empty, current: currentRes.data };
    }
    return { ...empty, error: error.message, current: currentRes.data };
  }

  const fichasByAppt = new Map<string, AppointmentFichaInstance[]>();
  for (const row of rows ?? []) {
    const ficha = mapFichaRow(row as Record<string, unknown>);
    if (!ficha) continue;
    const hasContent = hasFichaResponses(ficha.responses) || ficha.status === "concluida";
    if (!hasContent) continue;
    const list = fichasByAppt.get(ficha.appointment_id) ?? [];
    list.push(ficha);
    fichasByAppt.set(ficha.appointment_id, list);
  }

  const previous: FichaHistoryAppointment[] = [];
  const copySources: FichaCopySource[] = [];

  for (const appt of appts ?? []) {
    const apptId = String(appt.id);
    const fichas = (fichasByAppt.get(apptId) ?? []).sort(
      (a, b) => a.template.display_order - b.template.display_order
    );
    if (fichas.length === 0) continue;

    const doctorRaw = Array.isArray(appt.doctor) ? appt.doctor[0] : appt.doctor;
    const doctorName = (doctorRaw as { full_name?: string } | null)?.full_name ?? null;
    const scheduledAt = String(appt.scheduled_at);

    previous.push({
      appointment_id: apptId,
      scheduled_at: scheduledAt,
      doctor_name: doctorName,
      is_current_appointment: false,
      fichas,
    });

    const copyableFichas = fichas
      .filter(
        (f) =>
          COPYABLE_FICHA_TYPES.has(f.template.ficha_type) && hasFichaResponses(f.responses)
      )
      .map((f) => ({
        ficha_template_id: f.ficha_template_id,
        template_name: f.template.name,
        has_content: true,
      }));

    if (copyableFichas.length > 0) {
      copySources.push({
        appointment_id: apptId,
        scheduled_at: scheduledAt,
        doctor_name: doctorName,
        fichas: copyableFichas,
      });
    }
  }

  return {
    error: null,
    current: currentRes.data,
    previous,
    copySources,
  };
}

export async function copyFichaResponsesFromAppointment(params: {
  sourceAppointmentId: string;
  targetAppointmentId: string;
  fichaTemplateIds?: string[];
  overwrite?: boolean;
}): Promise<{ error: string | null; result?: CopyFichaResult }> {
  const { sourceAppointmentId, targetAppointmentId, fichaTemplateIds, overwrite = false } =
    params;

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
    return { error: "Sem permissão para copiar fichas." };
  }

  if (sourceAppointmentId === targetAppointmentId) {
    return { error: "A consulta de origem e destino devem ser diferentes." };
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, patient_id, clinic_id")
    .in("id", [sourceAppointmentId, targetAppointmentId])
    .eq("clinic_id", profile.clinic_id);

  if (!appointments || appointments.length !== 2) {
    return { error: "Consultas não encontradas." };
  }

  const sourceAppt = appointments.find((a) => a.id === sourceAppointmentId);
  const targetAppt = appointments.find((a) => a.id === targetAppointmentId);
  if (!sourceAppt || !targetAppt || sourceAppt.patient_id !== targetAppt.patient_id) {
    return { error: "As consultas devem ser do mesmo paciente." };
  }

  const { data: sourceRows, error: sourceErr } = await supabase
    .from("appointment_ficha_instances")
    .select(
      `
      ficha_template_id,
      responses,
      clinical_ficha_templates ( ficha_type, name )
    `
    )
    .eq("appointment_id", sourceAppointmentId);

  if (sourceErr) return { error: sourceErr.message };

  const { data: targetRows, error: targetErr } = await supabase
    .from("appointment_ficha_instances")
    .select("id, ficha_template_id, responses, status")
    .eq("appointment_id", targetAppointmentId);

  if (targetErr) return { error: targetErr.message };

  const targetByTemplate = new Map(
    (targetRows ?? []).map((r) => [String(r.ficha_template_id), r])
  );

  const filterSet = fichaTemplateIds ? new Set(fichaTemplateIds) : null;
  const result: CopyFichaResult = { copied: 0, skipped: 0, messages: [] };

  for (const row of sourceRows ?? []) {
    const templateId = String(row.ficha_template_id);
    if (filterSet && !filterSet.has(templateId)) continue;

    const tplRaw = row.clinical_ficha_templates;
    const tpl = Array.isArray(tplRaw) ? tplRaw[0] : tplRaw;
    const fichaType = (tpl as { ficha_type?: string })?.ficha_type ?? "";
    const templateName = (tpl as { name?: string })?.name ?? "Ficha";

    if (!COPYABLE_FICHA_TYPES.has(fichaType)) {
      result.skipped += 1;
      result.messages.push(`${templateName}: tipo não copiável.`);
      continue;
    }

    const sourceResponses = (row.responses as Record<string, unknown>) ?? {};
    if (!hasFichaResponses(sourceResponses)) {
      result.skipped += 1;
      result.messages.push(`${templateName}: sem conteúdo na origem.`);
      continue;
    }

    const target = targetByTemplate.get(templateId);
    if (!target) {
      result.skipped += 1;
      result.messages.push(`${templateName}: ficha não existe na consulta atual.`);
      continue;
    }

    const targetResponses = (target.responses as Record<string, unknown>) ?? {};
    const targetHasContent = hasFichaResponses(targetResponses);
    if (targetHasContent && !overwrite) {
      result.skipped += 1;
      result.messages.push(`${templateName}: já possui conteúdo (não substituída).`);
      continue;
    }

    if (target.status === "concluida") {
      result.skipped += 1;
      result.messages.push(`${templateName}: ficha já concluída.`);
      continue;
    }

    const { error: updateErr } = await supabase
      .from("appointment_ficha_instances")
      .update({
        responses: sourceResponses,
        status: "rascunho",
        filled_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);

    if (updateErr) {
      result.skipped += 1;
      result.messages.push(`${templateName}: erro ao copiar.`);
      continue;
    }

    result.copied += 1;
  }

  revalidatePath(`/dashboard/agenda/atendimento/${targetAppointmentId}`);

  return { error: null, result };
}

export async function getPatientFichasDetailForProntuario(patientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as AppointmentFichaDetail[] };

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
      responses,
      clinical_ficha_templates ( name, ficha_type, definition )
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

  const data: AppointmentFichaDetail[] = (rows ?? []).map((row: Record<string, unknown>) => {
    const tpl = Array.isArray(row.clinical_ficha_templates)
      ? row.clinical_ficha_templates[0]
      : row.clinical_ficha_templates;
    const apptId = String(row.appointment_id);
    const def = (tpl as { definition?: unknown })?.definition;
    return {
      instance_id: String(row.id),
      ficha_name: String((tpl as { name?: string })?.name ?? "Ficha"),
      ficha_type: (tpl as { ficha_type?: string })?.ficha_type as AppointmentFichaDetail["ficha_type"],
      status: String(row.status),
      updated_at: String(row.updated_at),
      appointment_id: apptId,
      scheduled_at: scheduledByAppt.get(apptId) ?? "",
      definition: (Array.isArray(def) ? def : []) as FormFieldDefinition[],
      responses: (row.responses as Record<string, unknown>) ?? {},
    };
  });

  return { error: null, data };
}
