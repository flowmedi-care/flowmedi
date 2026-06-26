"use server";

import { createClient } from "@/lib/supabase/server";
import { syncNonRegisteredToPipeline } from "@/app/dashboard/pipeline/actions";
import {
  getAppointmentIdsNeedingFormLink,
  getPatientIdsWithAppointment,
  getPendingEvents,
} from "@/app/dashboard/eventos/actions";
import {
  buildLeadJourney,
  buildPatientJourney,
  decodeContactKey,
  filterJourneys,
  type ContactJourney,
  type JourneyEventRef,
  type JourneyListFilters,
  type JourneyActionContext,
} from "@/lib/contact-journey";
import type { PipelineLeadInput, PatientJourneyInput } from "@/lib/contact-journey/resolver";

function mapEvent(raw: Record<string, unknown>): JourneyEventRef {
  return {
    id: String(raw.id),
    event_code: String(raw.event_code ?? ""),
    event_name: String(raw.event_name ?? raw.event_code ?? "Evento"),
    status: String(raw.status ?? "pending"),
    patient_id: raw.patient_id ? String(raw.patient_id) : null,
    appointment_id: raw.appointment_id ? String(raw.appointment_id) : null,
    appointment_scheduled_at: raw.appointment_scheduled_at
      ? String(raw.appointment_scheduled_at)
      : null,
    appointment_status: raw.appointment_status ? String(raw.appointment_status) : null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    occurred_at: String(raw.occurred_at ?? raw.created_at ?? new Date().toISOString()),
    patient_name: raw.patient_name ? String(raw.patient_name) : null,
  };
}

async function buildActionContext(): Promise<JourneyActionContext> {
  const [patientRes, apptFormRes] = await Promise.all([
    getPatientIdsWithAppointment(),
    getAppointmentIdsNeedingFormLink(),
  ]);

  return {
    patientIdsWithAppointment: patientRes.data ?? [],
    appointmentIdsNeedingForm: apptFormRes.data ?? [],
    isAppointmentToday: (scheduledAt: string | null) => {
      if (!scheduledAt) return false;
      const d = new Date(scheduledAt);
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    },
  };
}

function eventsForLead(email: string, allEvents: JourneyEventRef[]): JourneyEventRef[] {
  const emailLower = email.toLowerCase().trim();
  return allEvents.filter((e) => {
    if (e.event_code === "public_form_completed") {
      const metaEmail = String((e.metadata?.public_submitter_email as string) ?? "").toLowerCase().trim();
      return metaEmail === emailLower;
    }
    return false;
  });
}

function eventsForPatient(patientId: string, allEvents: JourneyEventRef[]): JourneyEventRef[] {
  return allEvents.filter((e) => e.patient_id === patientId);
}

async function fetchJourneyData(clinicId: string) {
  const supabase = await createClient();

  const [pipelineRes, pendingEventsRes, formEmailsRes] = await Promise.all([
    supabase
      .from("non_registered_pipeline")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("updated_at", { ascending: false }),
    getPendingEvents(),
    supabase
      .from("form_instances")
      .select("public_submitter_email")
      .is("appointment_id", null)
      .not("public_submitter_email", "is", null),
  ]);

  const pipelineItems = pipelineRes.data ?? [];
  const pipelineIds = pipelineItems.map((p) => p.id);

  const { data: historyItems } =
    pipelineIds.length > 0
      ? await supabase
          .from("non_registered_history")
          .select("id, pipeline_id, action_type, old_stage, new_stage, notes, created_at")
          .in("pipeline_id", pipelineIds)
          .order("created_at", { ascending: false })
      : { data: [] as Record<string, unknown>[] };

  const formEmails = new Set(
    (formEmailsRes.data ?? [])
      .map((f) => String(f.public_submitter_email ?? "").toLowerCase().trim())
      .filter(Boolean)
  );

  const leadEmails = new Set(pipelineItems.map((p) => p.email.toLowerCase().trim()));

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, updated_at")
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const patientList = patients ?? [];
  const patientIds = patientList.map((p) => p.id);

  const { data: appointments } =
    patientIds.length > 0
      ? await supabase
          .from("appointments")
          .select("id, patient_id, status, scheduled_at, appointment_type_id, appointment_types(slug, name)")
          .eq("clinic_id", clinicId)
          .in("patient_id", patientIds)
          .in("status", ["agendada", "confirmada", "realizada", "falta", "cancelada"])
          .order("scheduled_at", { ascending: false })
      : { data: [] as Record<string, unknown>[] };

  const apptIds = (appointments ?? []).map((a) => String(a.id));

  const { data: formInstances } =
    apptIds.length > 0
      ? await supabase
          .from("form_instances")
          .select("id, appointment_id, status")
          .in("appointment_id", apptIds)
      : { data: [] as Record<string, unknown>[] };

  const allPendingEvents = (pendingEventsRes.data ?? []).map((e: Record<string, unknown>) =>
    mapEvent(e)
  );

  return {
    pipelineItems,
    historyItems: historyItems ?? [],
    formEmails,
    leadEmails,
    patientList,
    appointments: appointments ?? [],
    formInstances: formInstances ?? [],
    allPendingEvents,
  };
}

function pickRelevantAppointment(
  patientId: string,
  appointments: Record<string, unknown>[]
): PatientJourneyInput["appointment"] {
  const patientAppts = appointments
    .filter((a) => String(a.patient_id) === patientId)
    .sort(
      (a, b) =>
        new Date(String(b.scheduled_at)).getTime() - new Date(String(a.scheduled_at)).getTime()
    );

  const active = patientAppts.find((a) =>
    ["agendada", "confirmada"].includes(String(a.status))
  );
  const chosen = active ?? patientAppts[0];
  if (!chosen) return null;

  const apptType = Array.isArray(chosen.appointment_types)
    ? chosen.appointment_types[0]
    : chosen.appointment_types;
  const slug = (apptType as { slug?: string } | null)?.slug;

  return {
    id: String(chosen.id),
    status: String(chosen.status),
    scheduled_at: String(chosen.scheduled_at),
    is_return: slug === "retorno",
  };
}

export async function getJourneyList(filters?: JourneyListFilters): Promise<{
  data: ContactJourney[] | null;
  error: string | null;
}> {
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
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { data: null, error: "Não autorizado." };
  }

  await syncNonRegisteredToPipeline();

  const context = await buildActionContext();
  const data = await fetchJourneyData(profile.clinic_id);

  const historyByPipeline = new Map<string, PipelineLeadInput["history"]>();
  for (const h of data.historyItems) {
    const pid = String(h.pipeline_id);
    if (!historyByPipeline.has(pid)) historyByPipeline.set(pid, []);
    historyByPipeline.get(pid)!.push({
      id: String(h.id),
      action_type: String(h.action_type),
      old_stage: h.old_stage ? String(h.old_stage) : null,
      new_stage: h.new_stage ? String(h.new_stage) : null,
      notes: h.notes ? String(h.notes) : null,
      created_at: String(h.created_at),
    });
  }

  const journeys: ContactJourney[] = [];

  for (const item of data.pipelineItems) {
    const lead: PipelineLeadInput = {
      id: String(item.id),
      email: String(item.email),
      name: item.name ? String(item.name) : null,
      phone: item.phone ? String(item.phone) : null,
      stage: String(item.stage),
      updated_at: String(item.updated_at),
      history: historyByPipeline.get(String(item.id)) ?? [],
      hasPublicForm: data.formEmails.has(String(item.email).toLowerCase().trim()),
    };
    const events = eventsForLead(lead.email, data.allPendingEvents);
    journeys.push(buildLeadJourney(lead, events, context));
  }

  for (const patient of data.patientList) {
    const emailLower = patient.email?.toLowerCase().trim();
    if (emailLower && data.leadEmails.has(emailLower)) continue;

    const appt = pickRelevantAppointment(String(patient.id), data.appointments);
    const apptForms = appt
      ? data.formInstances.filter((fi) => String(fi.appointment_id) === appt.id)
      : [];

    const patientInput: PatientJourneyInput = {
      id: String(patient.id),
      full_name: String(patient.full_name),
      email: patient.email ? String(patient.email) : null,
      phone: patient.phone ? String(patient.phone) : null,
      updated_at: String(patient.updated_at),
      appointment: appt,
      pendingFormCount: apptForms.filter((f) => String(f.status) !== "respondido").length,
      respondedFormCount: apptForms.filter((f) => String(f.status) === "respondido").length,
    };

    const events = eventsForPatient(patientInput.id, data.allPendingEvents);
    const hasActivity =
      events.length > 0 ||
      appt !== null ||
      ["consulta_agendada", "consulta_confirmada", "formulario_pendente"].includes(
        buildPatientJourney(patientInput, events, context).currentStep
      );

    if (events.length > 0 || appt) {
      journeys.push(buildPatientJourney(patientInput, events, context));
    } else if (hasActivity) {
      journeys.push(buildPatientJourney(patientInput, events, context));
    }
  }

  journeys.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return { data: filterJourneys(journeys, filters), error: null };
}

export async function getJourneyDetail(contactKey: string): Promise<{
  data: ContactJourney | null;
  error: string | null;
}> {
  const decoded = decodeContactKey(contactKey);
  if (!decoded) return { data: null, error: "Contato inválido." };

  const listRes = await getJourneyList();
  if (listRes.error || !listRes.data) return { data: null, error: listRes.error };

  const found = listRes.data.find((j) => j.contactKey === contactKey);
  if (!found) return { data: null, error: "Jornada não encontrada." };

  return { data: found, error: null };
}

export async function getContactJourneyForAi(params: {
  clinicId: string;
  phone?: string;
  email?: string;
  patientId?: string;
}): Promise<{ summary: string | null; journey: ContactJourney | null }> {
  const { formatJourneySummaryForAi } = await import("@/lib/contact-journey/resolver");

  const supabase = await createClient();
  const context = await buildActionContext();
  const data = await fetchJourneyData(params.clinicId);

  if (params.patientId) {
    const patient = data.patientList.find((p) => String(p.id) === params.patientId);
    if (patient) {
      const appt = pickRelevantAppointment(String(patient.id), data.appointments);
      const apptForms = appt
        ? data.formInstances.filter((fi) => String(fi.appointment_id) === appt.id)
        : [];
      const patientInput: PatientJourneyInput = {
        id: String(patient.id),
        full_name: String(patient.full_name),
        email: patient.email ? String(patient.email) : null,
        phone: patient.phone ? String(patient.phone) : null,
        updated_at: String(patient.updated_at),
        appointment: appt,
        pendingFormCount: apptForms.filter((f) => String(f.status) !== "respondido").length,
        respondedFormCount: apptForms.filter((f) => String(f.status) === "respondido").length,
      };
      const events = eventsForPatient(patientInput.id, data.allPendingEvents);
      const journey = buildPatientJourney(patientInput, events, context, "whatsapp");
      return { summary: formatJourneySummaryForAi(journey), journey };
    }
  }

  if (params.email) {
    const emailLower = params.email.toLowerCase().trim();
    const lead = data.pipelineItems.find(
      (p) => String(p.email).toLowerCase().trim() === emailLower
    );
    if (lead) {
      const leadInput: PipelineLeadInput = {
        id: String(lead.id),
        email: String(lead.email),
        name: lead.name ? String(lead.name) : null,
        phone: lead.phone ? String(lead.phone) : null,
        stage: String(lead.stage),
        updated_at: String(lead.updated_at),
        history: [],
        hasPublicForm: data.formEmails.has(emailLower),
      };
      const events = eventsForLead(leadInput.email, data.allPendingEvents);
      const journey = buildLeadJourney(leadInput, events, context);
      return { summary: formatJourneySummaryForAi(journey), journey };
    }
  }

  if (params.phone) {
    const normalized = params.phone.replace(/\D/g, "");
    const lead = data.pipelineItems.find((p) => {
      const pPhone = String(p.phone ?? "").replace(/\D/g, "");
      return pPhone && normalized.endsWith(pPhone.slice(-8));
    });
    if (lead) {
      const leadInput: PipelineLeadInput = {
        id: String(lead.id),
        email: String(lead.email),
        name: lead.name ? String(lead.name) : null,
        phone: lead.phone ? String(lead.phone) : null,
        stage: String(lead.stage),
        updated_at: String(lead.updated_at),
        history: [],
        hasPublicForm: data.formEmails.has(String(lead.email).toLowerCase().trim()),
      };
      const events = eventsForLead(leadInput.email, data.allPendingEvents);
      const journey = buildLeadJourney(leadInput, events, context);
      return { summary: formatJourneySummaryForAi(journey), journey };
    }

    const patient = data.patientList.find((p) => {
      const pPhone = String(p.phone ?? "").replace(/\D/g, "");
      return pPhone && normalized.endsWith(pPhone.slice(-8));
    });
    if (patient) {
      return getContactJourneyForAi({
        clinicId: params.clinicId,
        patientId: String(patient.id),
      });
    }
  }

  return { summary: null, journey: null };
}
