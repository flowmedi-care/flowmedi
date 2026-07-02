"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { insertAuditLog } from "@/lib/audit-log";
import { computeDsarDueAt, getDsarSlaTier } from "@/lib/compliance/dsar-sla";

export type DsarRequestType =
  | "access"
  | "correction"
  | "deletion"
  | "portability"
  | "opposition"
  | "other";

export async function listDataSubjectRequests() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || !["admin", "secretaria"].includes(profile.role)) {
    return { data: [], error: "Sem permissão." };
  }

  const { data, error } = await supabase
    .from("data_subject_requests")
    .select(
      "id, request_type, status, requester_name, requester_email, requester_phone, notes, response_notes, patient_id, created_at, completed_at, due_at, sla_tier, source"
    )
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function createDataSubjectRequest(input: {
  requestType: DsarRequestType;
  patientId?: string | null;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  notes?: string;
}) {
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

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Apenas administradores podem registrar solicitações." };
  }

  const createdAt = new Date();
  const dueAt = computeDsarDueAt(input.requestType, createdAt);

  const { error } = await supabase.from("data_subject_requests").insert({
    clinic_id: profile.clinic_id,
    patient_id: input.patientId || null,
    request_type: input.requestType,
    requester_name: input.requesterName.trim(),
    requester_email: input.requesterEmail?.trim() || null,
    requester_phone: input.requesterPhone?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: profile.id,
    status: "open",
    source: "clinic_panel",
    due_at: dueAt.toISOString(),
    sla_tier: getDsarSlaTier(input.requestType),
    created_at: createdAt.toISOString(),
  });

  if (error) return { error: error.message };

  await insertAuditLog(supabase, {
    clinic_id: profile.clinic_id,
    user_id: profile.id,
    action: "dsar_created",
    entity_type: "data_subject_request",
    new_values: { request_type: input.requestType, requester_name: input.requesterName },
  });

  revalidatePath("/dashboard/privacidade/solicitacoes");
  return { error: null };
}

export async function updateDataSubjectRequestStatus(
  requestId: string,
  status: "in_progress" | "completed" | "rejected",
  responseNotes?: string
) {
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

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { error: "Apenas administradores." };
  }

  const { error } = await supabase
    .from("data_subject_requests")
    .update({
      status,
      response_notes: responseNotes?.trim() || null,
      completed_at: status === "completed" || status === "rejected" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };

  await insertAuditLog(supabase, {
    clinic_id: profile.clinic_id,
    user_id: profile.id,
    action: "dsar_status_updated",
    entity_type: "data_subject_request",
    entity_id: requestId,
    new_values: { status },
  });

  revalidatePath("/dashboard/privacidade/solicitacoes");
  return { error: null };
}

export async function exportPatientDataForDsar(patientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { data: null, error: "Apenas administradores." };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) return { data: null, error: "Paciente não encontrado." };

  const [appointments, consents, forms] = await Promise.all([
    supabase.from("appointments").select("*").eq("patient_id", patientId),
    supabase.from("consents").select("*").eq("patient_id", patientId),
    supabase.from("form_instances").select("id, status, created_at, responses").eq("patient_id", patientId),
  ]);

  const exportPayload = {
    exported_at: new Date().toISOString(),
    patient,
    appointments: appointments.data ?? [],
    consents: consents.data ?? [],
    form_instances: forms.data ?? [],
  };

  await insertAuditLog(supabase, {
    clinic_id: profile.clinic_id,
    user_id: user.id,
    action: "dsar_export",
    entity_type: "patient",
    entity_id: patientId,
  });

  return { data: exportPayload, error: null };
}

/** Verifica se o paciente possui registros clínicos que impedem exclusão total (CFM). */
async function patientHasClinicalRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  clinicId: string
): Promise<boolean> {
  const [appointments, notes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .limit(1),
    supabase
      .from("consultation_notes")
      .select("id")
      .eq("patient_id", patientId)
      .limit(1),
  ]);

  return Boolean(appointments.data?.length || notes.data?.length);
}

/**
 * Eliminação vs bloqueio: se houver prontuário, anonimiza identificadores e bloqueia acesso.
 * Caso contrário, exclui o paciente.
 */
export async function processPatientDeletionRequest(patientId: string, requestId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { action: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { action: null, error: "Apenas administradores." };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, clinic_id, full_name, email, photo_url")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) return { action: null, error: "Paciente não encontrado." };

  const hasClinical = await patientHasClinicalRecords(
    supabase,
    patientId,
    profile.clinic_id
  );

  if (hasClinical) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("patients")
      .update({
        full_name: "Titular anonimizado",
        email: null,
        phone: null,
        birth_date: null,
        cpf: null,
        notes: null,
        photo_url: null,
        anonymized_at: now,
        data_blocked_at: now,
        updated_at: now,
      })
      .eq("id", patientId)
      .eq("clinic_id", profile.clinic_id);

    if (error) return { action: null, error: error.message };

    await insertAuditLog(supabase, {
      clinic_id: profile.clinic_id,
      user_id: profile.id,
      action: "patient_anonymized_dsar",
      entity_type: "patient",
      entity_id: patientId,
      new_values: { request_id: requestId ?? null, reason: "clinical_records_retained" },
    });

    if (requestId) {
      await supabase
        .from("data_subject_requests")
        .update({
          response_notes:
            "Dados identificáveis anonimizados. Registros clínicos mantidos conforme obrigação legal (CFM).",
          updated_at: now,
        })
        .eq("id", requestId)
        .eq("clinic_id", profile.clinic_id);
    }

    revalidatePath("/dashboard/privacidade/solicitacoes");
    revalidatePath("/dashboard/contatos/pacientes");
    return { action: "anonymized" as const, error: null };
  }

  const { deletePatient } = await import("@/app/dashboard/pacientes/actions");
  const del = await deletePatient(patientId);
  if (del.error) return { action: null, error: del.error };

  await insertAuditLog(supabase, {
    clinic_id: profile.clinic_id,
    user_id: profile.id,
    action: "patient_deleted_dsar",
    entity_type: "patient",
    entity_id: patientId,
    new_values: { request_id: requestId ?? null },
  });

  revalidatePath("/dashboard/privacidade/solicitacoes");
  return { action: "deleted" as const, error: null };
}
