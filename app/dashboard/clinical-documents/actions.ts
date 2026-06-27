"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { renderClinicalDocumentHtml, isExamOrderContent, isCertificateContent } from "@/lib/clinical-documents/render";
import { renderExamRequestModernHtml } from "@/lib/clinical-documents/render-exam-modern";
import { renderCertificateModernHtml } from "@/lib/clinical-documents/render-certificate-modern";
import { renderPrescriptionModernHtml } from "@/lib/clinical-documents/render-prescription-modern";
import { DEFAULT_CLINICAL_PDF_LAYOUT, isClinicalPdfLayoutId } from "@/lib/clinical-documents/pdf-layouts";
import type {
  ClinicalDocument,
  ClinicalDocumentTemplate,
  ClinicalDocumentType,
  DocumentRenderContext,
  ExamCatalogItem,
  ExamItem,
  ExamOrderLine,
  CertificateCatalogItem,
  MedicationCatalogItem,
  MedicationItem,
  StructuredContent,
} from "@/lib/clinical-documents/types";
import { emptyStructuredContent } from "@/lib/clinical-documents/render";
import { getReferralLinkForDoctor } from "@/app/dashboard/perfil/referral-actions";

async function getAuthDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role, full_name, cpf, crm, crm_uf, logo_url, logo_scale")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "medico") {
    return { error: "Apenas médicos podem emitir documentos clínicos.", supabase, user, profile: null };
  }

  return { error: null, supabase, user, profile };
}

function parseStructuredContent(
  type: ClinicalDocumentType,
  raw: unknown
): StructuredContent {
  if (!raw || typeof raw !== "object") return emptyStructuredContent(type);
  const obj = raw as Record<string, unknown>;
  if (type === "prescription" && Array.isArray(obj.medications)) {
    return {
      medications: (obj.medications as MedicationItem[]).map((m) => ({
        name: String(m?.name ?? ""),
        dosage: String(m?.dosage ?? ""),
        quantity: String(m?.quantity ?? ""),
        instructions: String(m?.instructions ?? ""),
      })),
    };
  }
  if (type === "exam_request" && Array.isArray(obj.examLines)) {
    return {
      examLines: (obj.examLines as ExamOrderLine[]).map((l) => ({
        catalogId: l?.catalogId ? String(l.catalogId) : undefined,
        name: String(l?.name ?? ""),
        details: String(l?.details ?? ""),
      })),
      examNotes: obj.examNotes ? String(obj.examNotes) : "",
      layoutId: obj.layoutId && isClinicalPdfLayoutId(String(obj.layoutId))
        ? String(obj.layoutId)
        : undefined,
    };
  }
  if (type === "certificate" && typeof obj.certificateBody === "string") {
    return {
      certificateBody: String(obj.certificateBody),
      certificateDays: obj.certificateDays ? Number(obj.certificateDays) : 1,
      certificateCid: obj.certificateCid ? String(obj.certificateCid) : "",
      layoutId: obj.layoutId && isClinicalPdfLayoutId(String(obj.layoutId))
        ? String(obj.layoutId)
        : undefined,
    };
  }
  if (type === "exam_request" && Array.isArray(obj.selectedExamIds)) {
    return { examLines: [], examNotes: obj.examNotes ? String(obj.examNotes) : "" };
  }
  if (type === "exam_request" && Array.isArray(obj.exams)) {
    return {
      examLines: (obj.exams as ExamItem[]).map((e) => ({
        name: String(e?.name ?? ""),
        details: String(e?.notes ?? ""),
      })),
      examNotes: "",
    };
  }
  return emptyStructuredContent(type);
}

async function listExamCatalogForDoctor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  doctorId: string
): Promise<ExamCatalogItem[]> {
  const { data } = await supabase
    .from("clinical_exam_catalog")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .or(`scope.eq.clinic,and(scope.eq.doctor,doctor_id.eq.${doctorId})`)
    .order("category")
    .order("display_order")
    .order("name");
  return (data ?? []) as ExamCatalogItem[];
}

export async function loadDocumentRenderContext(
  patientId: string,
  doctorId: string,
  clinicId: string
): Promise<{ ctx: DocumentRenderContext | null; error: string | null }> {
  const supabase = await createClient();

  const [{ data: patient }, { data: doctor }, { data: clinic }] = await Promise.all([
    supabase
      .from("patients")
      .select("full_name, cpf, birth_date, phone")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single(),
    supabase
      .from("profiles")
      .select("full_name, crm, crm_uf, logo_url, logo_scale")
      .eq("id", doctorId)
      .single(),
    supabase
      .from("clinics")
      .select("name, phone, email, address, logo_url, logo_scale")
      .eq("id", clinicId)
      .single(),
  ]);

  if (!patient || !doctor || !clinic) {
    return { ctx: null, error: "Dados da clínica, médico ou paciente não encontrados." };
  }

  const emissionDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    ctx: {
      patient: {
        full_name: patient.full_name,
        cpf: patient.cpf ?? null,
        birth_date: patient.birth_date ?? null,
        phone: patient.phone ?? null,
      },
      doctor: {
        full_name: doctor.full_name ?? "Médico",
        crm: doctor.crm ?? null,
        crm_uf: doctor.crm_uf ?? null,
        logo_url: doctor.logo_url ?? null,
        logo_scale: doctor.logo_scale ?? null,
      },
      clinic: {
        name: clinic.name,
        phone: clinic.phone ?? null,
        email: clinic.email ?? null,
        address: clinic.address ?? null,
        logo_url: clinic.logo_url ?? null,
        logo_scale: clinic.logo_scale ?? null,
      },
      emission_date: emissionDate,
    },
    error: null,
  };
}

// ——— Templates ———

export async function listClinicalTemplates(
  type: ClinicalDocumentType
): Promise<{ data: ClinicalDocumentTemplate[]; error: string | null }> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("clinical_document_templates")
    .select("*")
    .eq("clinic_id", auth.profile.clinic_id)
    .eq("type", type)
    .eq("is_active", true)
    .or(`scope.eq.clinic,and(scope.eq.doctor,doctor_id.eq.${auth.user.id})`)
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ClinicalDocumentTemplate[], error: null };
}

export async function listClinicalTemplatesForManage(
  type: ClinicalDocumentType,
  scope: "clinic" | "doctor"
): Promise<{ data: ClinicalDocumentTemplate[]; error: string | null }> {
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

  if (!profile?.clinic_id) return { data: [], error: "Clínica não encontrada." };

  if (scope === "clinic" && profile.role !== "admin") {
    return { data: [], error: "Apenas administradores gerenciam templates da clínica." };
  }
  if (scope === "doctor" && profile.role !== "medico") {
    return { data: [], error: "Apenas médicos gerenciam templates pessoais." };
  }

  let query = supabase
    .from("clinical_document_templates")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .eq("type", type)
    .eq("scope", scope)
    .order("name");

  if (scope === "doctor") {
    query = query.eq("doctor_id", user.id);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ClinicalDocumentTemplate[], error: null };
}

export async function saveClinicalTemplate(input: {
  id?: string;
  type: ClinicalDocumentType;
  scope: "clinic" | "doctor";
  name: string;
  body: string;
  is_active?: boolean;
}): Promise<{ data: ClinicalDocumentTemplate | null; error: string | null }> {
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

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  if (input.scope === "clinic" && profile.role !== "admin") {
    return { data: null, error: "Sem permissão." };
  }
  if (input.scope === "doctor" && profile.role !== "medico") {
    return { data: null, error: "Sem permissão." };
  }

  const row = {
    clinic_id: profile.clinic_id,
    type: input.type,
    scope: input.scope,
    doctor_id: input.scope === "doctor" ? user.id : null,
    name: input.name.trim(),
    body: input.body,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("clinical_document_templates")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/perfil");
    revalidatePath("/dashboard/configuracoes");
    return { data: data as ClinicalDocumentTemplate, error: null };
  }

  const { data, error } = await supabase
    .from("clinical_document_templates")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { data: data as ClinicalDocumentTemplate, error: null };
}

export async function deleteClinicalTemplate(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("clinical_document_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

// ——— Documents ———

export async function listClinicalDocuments(input: {
  appointmentId?: string;
  patientId?: string;
  type: ClinicalDocumentType;
  procedureId?: string | null;
}): Promise<{ data: ClinicalDocument[]; error: string | null }> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.profile) return { data: [], error: auth.error };

  let query = auth.supabase
    .from("clinical_documents")
    .select("*")
    .eq("clinic_id", auth.profile.clinic_id)
    .eq("type", input.type)
    .eq("doctor_id", auth.user!.id)
    .order("created_at", { ascending: false });

  if (input.appointmentId) query = query.eq("appointment_id", input.appointmentId);
  if (input.patientId) query = query.eq("patient_id", input.patientId);
  if (input.procedureId) query = query.eq("procedure_id", input.procedureId);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const docs = (data ?? []).map((d) => ({
    ...d,
    structured_content: parseStructuredContent(input.type, d.structured_content),
  })) as ClinicalDocument[];

  return { data: docs, error: null };
}

export async function getClinicalDocument(
  id: string
): Promise<{ data: ClinicalDocument | null; error: string | null }> {
  const auth = await getAuthDoctor();
  if (auth.error) return { data: null, error: auth.error };

  const { data, error } = await auth.supabase
    .from("clinical_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { data: null, error: error.message };
  const doc = {
    ...data,
    structured_content: parseStructuredContent(data.type as ClinicalDocumentType, data.structured_content),
  } as ClinicalDocument;
  return { data: doc, error: null };
}

export async function saveClinicalDocumentDraft(input: {
  id?: string;
  type: ClinicalDocumentType;
  patientId: string;
  appointmentId: string | null;
  procedureId?: string | null;
  templateId?: string | null;
  title?: string | null;
  bodyText: string;
  structuredContent: StructuredContent;
}): Promise<{ data: ClinicalDocument | null; error: string | null }> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { data: null, error: auth.error };

  const { data: patient } = await auth.supabase
    .from("patients")
    .select("id")
    .eq("id", input.patientId)
    .eq("clinic_id", auth.profile.clinic_id)
    .single();

  if (!patient) return { data: null, error: "Paciente não encontrado." };

  if (input.appointmentId) {
    const { data: appt } = await auth.supabase
      .from("appointments")
      .select("id")
      .eq("id", input.appointmentId)
      .eq("clinic_id", auth.profile.clinic_id)
      .single();
    if (!appt) return { data: null, error: "Consulta não encontrada." };
  }

  const row = {
    clinic_id: auth.profile.clinic_id,
    type: input.type,
    patient_id: input.patientId,
    appointment_id: input.appointmentId,
    procedure_id: input.procedureId ?? null,
    doctor_id: auth.user.id,
    template_id: input.templateId ?? null,
    title: input.title?.trim() || null,
    body_text: input.bodyText,
    structured_content: input.structuredContent,
    status: "draft" as const,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: existing } = await auth.supabase
      .from("clinical_documents")
      .select("status")
      .eq("id", input.id)
      .eq("doctor_id", auth.user.id)
      .single();

    if (!existing) return { data: null, error: "Documento não encontrado." };
    if (existing.status !== "draft") {
      return { data: null, error: "Somente rascunhos podem ser editados." };
    }

    const { data, error } = await auth.supabase
      .from("clinical_documents")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    revalidatePath(`/dashboard/agenda/consulta/${input.appointmentId ?? ""}`);
    return {
      data: {
        ...data,
        structured_content: parseStructuredContent(input.type, data.structured_content),
      } as ClinicalDocument,
      error: null,
    };
  }

  const { data, error } = await auth.supabase
    .from("clinical_documents")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  revalidatePath(`/dashboard/agenda/consulta/${input.appointmentId ?? ""}`);
  return {
    data: {
      ...data,
      structured_content: parseStructuredContent(input.type, data.structured_content),
    } as ClinicalDocument,
    error: null,
  };
}

export async function finalizeClinicalDocumentManual(
  documentId: string,
  layoutId?: string | null
): Promise<{ html: string | null; error: string | null }> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { html: null, error: auth.error };

  const { data: doc, error: fetchErr } = await auth.supabase
    .from("clinical_documents")
    .select("*")
    .eq("id", documentId)
    .eq("doctor_id", auth.user.id)
    .single();

  if (fetchErr || !doc) return { html: null, error: "Documento não encontrado." };
  if (doc.status !== "draft") return { html: null, error: "Documento já finalizado." };

  const type = doc.type as ClinicalDocumentType;
  const structured = parseStructuredContent(type, doc.structured_content);

  const { ctx, error: ctxErr } = await loadDocumentRenderContext(
    doc.patient_id,
    doc.doctor_id,
    doc.clinic_id
  );
  if (ctxErr || !ctx) return { html: null, error: ctxErr ?? "Erro ao carregar dados." };

  let html: string;

  if (type === "prescription" && "medications" in structured) {
    html = renderPrescriptionModernHtml({
      ctx,
      medications: structured.medications,
      bodyText: doc.body_text,
      manualSignature: true,
    });
  } else if (type === "exam_request" && isExamOrderContent(structured)) {
    const referralLink = await getReferralLinkForDoctor(doc.doctor_id, doc.clinic_id);
    const qrCodeUrl = referralLink
      ? `https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(referralLink)}`
      : null;
    const resolvedLayout =
      layoutId && isClinicalPdfLayoutId(layoutId)
        ? layoutId
        : structured.layoutId ?? DEFAULT_CLINICAL_PDF_LAYOUT;
    html = renderExamRequestModernHtml({
      ctx,
      examLines: structured.examLines,
      examNotes: structured.examNotes,
      qrCodeUrl,
      layoutId: resolvedLayout,
    });
  } else if (type === "certificate" && isCertificateContent(structured)) {
    const resolvedLayout =
      layoutId && isClinicalPdfLayoutId(layoutId)
        ? layoutId
        : structured.layoutId ?? DEFAULT_CLINICAL_PDF_LAYOUT;
    html = renderCertificateModernHtml({
      ctx,
      certificateBody: structured.certificateBody,
      certificateDays: structured.certificateDays,
      certificateCid: structured.certificateCid,
      layoutId: resolvedLayout,
    });
  } else {
    html = renderClinicalDocumentHtml({
      type,
      title: doc.title,
      bodyText: doc.body_text,
      structuredContent: structured,
      ctx,
      manualSignature: true,
    });
  }

  const { error: updateErr } = await auth.supabase
    .from("clinical_documents")
    .update({
      body_rendered: html,
      structured_content: {
        ...structured,
        ...(layoutId && isClinicalPdfLayoutId(layoutId) ? { layoutId } : {}),
      },
      signature_mode: "manual",
      status: "issued_manual",
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (updateErr) return { html: null, error: updateErr.message };

  if (doc.appointment_id) {
    revalidatePath(`/dashboard/agenda/consulta/${doc.appointment_id}`);
  }
  return { html, error: null };
}

export async function getClinicalDocumentHtml(
  documentId: string
): Promise<{ html: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { html: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { html: null, error: "Clínica não encontrada." };

  const { data: doc, error } = await supabase
    .from("clinical_documents")
    .select("body_rendered, status, clinic_id")
    .eq("id", documentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (error || !doc?.body_rendered) {
    return { html: null, error: error?.message ?? "Documento sem visualização." };
  }
  return { html: doc.body_rendered as string, error: null };
}

// ——— Catálogos ———

export async function listMedicationCatalog(): Promise<{
  data: MedicationCatalogItem[];
  error: string | null;
}> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("clinical_medication_catalog")
    .select("*")
    .eq("clinic_id", auth.profile.clinic_id)
    .eq("is_active", true)
    .or(`scope.eq.clinic,and(scope.eq.doctor,doctor_id.eq.${auth.user.id})`)
    .order("display_order")
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as MedicationCatalogItem[], error: null };
}

export async function listExamCatalog(): Promise<{
  data: ExamCatalogItem[];
  error: string | null;
}> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { data: [], error: auth.error };

  const data = await listExamCatalogForDoctor(
    auth.supabase,
    auth.profile.clinic_id,
    auth.user.id
  );
  return { data, error: null };
}

export async function listMedicationCatalogForManage(
  scope: "clinic" | "doctor"
): Promise<{ data: MedicationCatalogItem[]; error: string | null }> {
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
  if (!profile?.clinic_id) return { data: [], error: "Clínica não encontrada." };
  if (scope === "clinic" && profile.role !== "admin") return { data: [], error: "Sem permissão." };
  if (scope === "doctor" && profile.role !== "medico") return { data: [], error: "Sem permissão." };

  let query = supabase
    .from("clinical_medication_catalog")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .eq("scope", scope)
    .order("display_order")
    .order("name");
  if (scope === "doctor") query = query.eq("doctor_id", user.id);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as MedicationCatalogItem[], error: null };
}

export async function listExamCatalogForManage(
  scope: "clinic" | "doctor"
): Promise<{ data: ExamCatalogItem[]; error: string | null }> {
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
  if (!profile?.clinic_id) return { data: [], error: "Clínica não encontrada." };
  if (scope === "clinic" && profile.role !== "admin") return { data: [], error: "Sem permissão." };
  if (scope === "doctor" && profile.role !== "medico") return { data: [], error: "Sem permissão." };

  let query = supabase
    .from("clinical_exam_catalog")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .eq("scope", scope)
    .order("category")
    .order("display_order")
    .order("name");
  if (scope === "doctor") query = query.eq("doctor_id", user.id);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ExamCatalogItem[], error: null };
}

export async function saveMedicationCatalogItem(input: {
  id?: string;
  scope: "clinic" | "doctor";
  name: string;
  default_dosage?: string;
  default_quantity?: string;
  default_instructions?: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<{ error: string | null }> {
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
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (input.scope === "clinic" && profile.role !== "admin") return { error: "Sem permissão." };
  if (input.scope === "doctor" && profile.role !== "medico") return { error: "Sem permissão." };

  const row = {
    clinic_id: profile.clinic_id,
    scope: input.scope,
    doctor_id: input.scope === "doctor" ? user.id : null,
    name: input.name.trim(),
    default_dosage: input.default_dosage ?? "",
    default_quantity: input.default_quantity ?? "",
    default_instructions: input.default_instructions ?? "",
    display_order: input.display_order ?? 0,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("clinical_medication_catalog").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("clinical_medication_catalog").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function previewClinicalDocumentHtml(input: {
  type: ClinicalDocumentType;
  patientId: string;
  appointmentId: string;
  bodyText: string;
  structuredContent: StructuredContent;
}): Promise<{ html: string | null; error: string | null }> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { html: null, error: auth.error };

  const { ctx, error: ctxErr } = await loadDocumentRenderContext(
    input.patientId,
    auth.user.id,
    auth.profile.clinic_id
  );
  if (ctxErr || !ctx) return { html: null, error: ctxErr ?? "Erro ao carregar dados." };

  const structured = input.structuredContent;

  if (input.type === "prescription" && "medications" in structured) {
    return {
      html: renderPrescriptionModernHtml({
        ctx,
        medications: structured.medications,
        bodyText: input.bodyText,
        manualSignature: true,
      }),
      error: null,
    };
  }

  if (input.type === "exam_request" && isExamOrderContent(structured)) {
    const referralLink = await getReferralLinkForDoctor(auth.user.id, auth.profile.clinic_id);
    const qrCodeUrl = referralLink
      ? `https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(referralLink)}`
      : null;
    return {
      html: renderExamRequestModernHtml({
        ctx,
        examLines: structured.examLines,
        examNotes: structured.examNotes,
        qrCodeUrl,
        layoutId: structured.layoutId ?? DEFAULT_CLINICAL_PDF_LAYOUT,
      }),
      error: null,
    };
  }

  if (input.type === "certificate" && isCertificateContent(structured)) {
    return {
      html: renderCertificateModernHtml({
        ctx,
        certificateBody: structured.certificateBody,
        certificateDays: structured.certificateDays,
        certificateCid: structured.certificateCid,
        layoutId: structured.layoutId ?? DEFAULT_CLINICAL_PDF_LAYOUT,
      }),
      error: null,
    };
  }

  return { html: null, error: "Conteúdo inválido para pré-visualização." };
}

export async function saveExamCatalogItem(input: {
  id?: string;
  scope: "clinic" | "doctor";
  name: string;
  category: string;
  default_details?: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<{ error: string | null }> {
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
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (input.scope === "clinic" && profile.role !== "admin") return { error: "Sem permissão." };
  if (input.scope === "doctor" && profile.role !== "medico") return { error: "Sem permissão." };

  const row = {
    clinic_id: profile.clinic_id,
    scope: input.scope,
    doctor_id: input.scope === "doctor" ? user.id : null,
    name: input.name.trim(),
    category: input.category.trim() || "Geral",
    default_details: input.default_details?.trim() ?? "",
    display_order: input.display_order ?? 0,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("clinical_exam_catalog").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("clinical_exam_catalog").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function deleteMedicationCatalogItem(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("clinical_medication_catalog").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function deleteExamCatalogItem(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("clinical_exam_catalog").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function listCertificateCatalog(): Promise<{
  data: CertificateCatalogItem[];
  error: string | null;
}> {
  const auth = await getAuthDoctor();
  if (auth.error || !auth.user || !auth.profile) return { data: [], error: auth.error };

  const { data, error } = await auth.supabase
    .from("clinical_certificate_catalog")
    .select("*")
    .eq("clinic_id", auth.profile.clinic_id)
    .eq("is_active", true)
    .or(`scope.eq.clinic,and(scope.eq.doctor,doctor_id.eq.${auth.user.id})`)
    .order("display_order")
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CertificateCatalogItem[], error: null };
}

export async function saveCertificateCatalogItem(input: {
  id?: string;
  scope: "clinic" | "doctor";
  name: string;
  default_body?: string;
  default_days?: number;
  default_cid?: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<{ error: string | null }> {
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
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (input.scope === "clinic" && profile.role !== "admin") return { error: "Sem permissão." };
  if (input.scope === "doctor" && profile.role !== "medico") return { error: "Sem permissão." };

  const row = {
    clinic_id: profile.clinic_id,
    scope: input.scope,
    doctor_id: input.scope === "doctor" ? user.id : null,
    name: input.name.trim(),
    default_body: input.default_body?.trim() ?? "",
    default_days: input.default_days ?? 1,
    default_cid: input.default_cid?.trim() ?? "",
    display_order: input.display_order ?? 0,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("clinical_certificate_catalog").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("clinical_certificate_catalog").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/perfil");
  revalidatePath("/dashboard/configuracoes");
  return { error: null };
}

export async function updateDoctorProfessionalInfo(input: {
  cpf?: string;
  crm?: string;
  crm_uf?: string;
  specialty?: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const updates: Record<string, string | null> = {};
  if (input.cpf !== undefined) updates.cpf = input.cpf.replace(/\D/g, "") || null;
  if (input.crm !== undefined) updates.crm = input.crm.trim() || null;
  if (input.crm_uf !== undefined) updates.crm_uf = input.crm_uf.trim().toUpperCase().slice(0, 2) || null;
  if (input.specialty !== undefined) updates.specialty = input.specialty.trim() || null;

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/perfil");
  return { error: null };
}

