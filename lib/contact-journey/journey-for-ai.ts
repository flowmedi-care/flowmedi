import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContactJourney,
  JourneyActionContext,
  JourneyEventRef,
} from "./types";
import {
  buildLeadJourney,
  buildPatientJourney,
  formatJourneySummaryForAi,
  type PipelineLeadInput,
  type PatientJourneyInput,
} from "./resolver";

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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  const suffixLen = Math.min(8, na.length, nb.length);
  return na.slice(-suffixLen) === nb.slice(-suffixLen);
}

function eventsForLead(email: string, allEvents: JourneyEventRef[]): JourneyEventRef[] {
  const emailLower = email.toLowerCase().trim();
  return allEvents.filter((e) => {
    if (e.event_code === "public_form_completed") {
      const metaEmail = String((e.metadata?.public_submitter_email as string) ?? "")
        .toLowerCase()
        .trim();
      return metaEmail === emailLower;
    }
    return false;
  });
}

function eventsForPatient(patientId: string, allEvents: JourneyEventRef[]): JourneyEventRef[] {
  return allEvents.filter((e) => e.patient_id === patientId);
}

function pickRelevantAppointment(
  patientId: string,
  appointments: Record<string, unknown>[],
  encounters: Record<string, unknown>[]
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

  const encounter = encounters.find((e) => String(e.appointment_id) === String(chosen.id));

  return {
    id: String(chosen.id),
    status: String(chosen.status),
    scheduled_at: String(chosen.scheduled_at),
    is_return: slug === "retorno",
    encounter_status: encounter ? String(encounter.status) : null,
    checked_in: false,
  };
}

async function buildJourneyActionContext(
  supabase: SupabaseClient,
  clinicId: string
): Promise<JourneyActionContext> {
  const { data: apptPatients } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .not("patient_id", "is", null);

  const patientIdsWithAppointment = [
    ...new Set((apptPatients ?? []).map((r) => String(r.patient_id))),
  ];

  const { data: appts } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinicId)
    .in("status", ["agendada", "confirmada"]);

  let appointmentIdsNeedingForm: string[] = [];
  if (appts?.length) {
    const { data: linked } = await supabase
      .from("form_instances")
      .select("appointment_id")
      .in(
        "appointment_id",
        appts.map((a) => a.id)
      );
    const idsWithForm = new Set((linked ?? []).map((r) => r.appointment_id));
    appointmentIdsNeedingForm = appts.map((a) => a.id).filter((id) => !idsWithForm.has(id));
  }

  return {
    patientIdsWithAppointment,
    appointmentIdsNeedingForm,
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

async function fetchPendingEvents(
  supabase: SupabaseClient,
  clinicId: string,
  patientId?: string
): Promise<JourneyEventRef[]> {
  const { data, error } = await supabase.rpc("get_pending_events", {
    p_clinic_id: clinicId,
    p_patient_id: patientId ?? null,
    p_event_code: null,
    p_limit: 50,
    p_offset: 0,
    p_secretary_id: null,
  });
  if (error) {
    console.warn("[journey-for-ai] get_pending_events:", error.message);
    return [];
  }
  return (data ?? []).map((e: Record<string, unknown>) => mapEvent(e));
}

async function loadPatientJourney(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  context: JourneyActionContext
): Promise<{ summary: string | null; journey: ContactJourney | null }> {
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, updated_at")
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) return { summary: null, journey: null };

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, patient_id, status, scheduled_at, appointment_types(slug)")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false })
    .limit(20);

  const apptList = appointments ?? [];
  const apptIds = apptList.map((a) => String(a.id));

  const { data: encounters } =
    apptIds.length > 0
      ? await supabase
          .from("encounters")
          .select("appointment_id, status")
          .in("appointment_id", apptIds)
      : { data: [] as Record<string, unknown>[] };

  const { data: formInstances } =
    apptIds.length > 0
      ? await supabase
          .from("form_instances")
          .select("id, appointment_id, status")
          .in("appointment_id", apptIds)
      : { data: [] as Record<string, unknown>[] };

  const appt = pickRelevantAppointment(patientId, apptList, encounters ?? []);
  const apptForms = appt
    ? (formInstances ?? []).filter((fi) => String(fi.appointment_id) === appt.id)
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

  const events = eventsForPatient(patientId, await fetchPendingEvents(supabase, clinicId, patientId));
  const journey = buildPatientJourney(patientInput, events, context, "whatsapp");
  return { summary: formatJourneySummaryForAi(journey), journey };
}

/**
 * Carrega jornada de um contato para contexto da IA.
 * Aceita Supabase com service role (webhook) ou sessão do dashboard.
 */
export async function loadContactJourneyForAi(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    phone?: string;
    email?: string;
    patientId?: string;
  }
): Promise<{ summary: string | null; journey: ContactJourney | null }> {
  const context = await buildJourneyActionContext(supabase, params.clinicId);

  if (params.patientId) {
    return loadPatientJourney(supabase, params.clinicId, params.patientId, context);
  }

  if (params.email) {
    const emailLower = params.email.toLowerCase().trim();
    const { data: lead } = await supabase
      .from("non_registered_pipeline")
      .select("*")
      .eq("clinic_id", params.clinicId)
      .ilike("email", emailLower)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead) {
      const { data: publicForm } = await supabase
        .from("form_instances")
        .select("id")
        .is("appointment_id", null)
        .ilike("public_submitter_email", emailLower)
        .limit(1)
        .maybeSingle();

      const leadInput: PipelineLeadInput = {
        id: String(lead.id),
        email: String(lead.email),
        name: lead.name ? String(lead.name) : null,
        phone: lead.phone ? String(lead.phone) : null,
        stage: String(lead.stage),
        lifecycle_stage: lead.lifecycle_stage ? String(lead.lifecycle_stage) : null,
        source: lead.source ? String(lead.source) : null,
        updated_at: String(lead.updated_at),
        history: [],
        hasPublicForm: Boolean(publicForm),
      };
      const allEvents = await fetchPendingEvents(supabase, params.clinicId);
      const events = eventsForLead(leadInput.email, allEvents);
      const journey = buildLeadJourney(leadInput, events, context);
      return { summary: formatJourneySummaryForAi(journey), journey };
    }
  }

  if (params.phone) {
    const normalized = normalizePhone(params.phone);

    const { data: leads } = await supabase
      .from("non_registered_pipeline")
      .select("*")
      .eq("clinic_id", params.clinicId)
      .order("updated_at", { ascending: false })
      .limit(200);

    const lead = (leads ?? []).find((p) => phonesMatch(String(p.phone ?? ""), normalized));
    if (lead) {
      const emailLower = String(lead.email).toLowerCase().trim();
      const { data: publicForm } = await supabase
        .from("form_instances")
        .select("id")
        .is("appointment_id", null)
        .ilike("public_submitter_email", emailLower)
        .limit(1)
        .maybeSingle();

      const leadInput: PipelineLeadInput = {
        id: String(lead.id),
        email: String(lead.email),
        name: lead.name ? String(lead.name) : null,
        phone: lead.phone ? String(lead.phone) : null,
        stage: String(lead.stage),
        lifecycle_stage: lead.lifecycle_stage ? String(lead.lifecycle_stage) : null,
        source: lead.source ? String(lead.source) : null,
        updated_at: String(lead.updated_at),
        history: [],
        hasPublicForm: Boolean(publicForm),
      };
      const allEvents = await fetchPendingEvents(supabase, params.clinicId);
      const events = eventsForLead(leadInput.email, allEvents);
      const journey = buildLeadJourney(leadInput, events, context);
      return { summary: formatJourneySummaryForAi(journey), journey };
    }

    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, email, phone, updated_at")
      .eq("clinic_id", params.clinicId)
      .not("phone", "is", null)
      .limit(500);

    const patient = (patients ?? []).find((p) => phonesMatch(String(p.phone ?? ""), normalized));
    if (patient) {
      return loadPatientJourney(supabase, params.clinicId, String(patient.id), context);
    }
  }

  return { summary: null, journey: null };
}
