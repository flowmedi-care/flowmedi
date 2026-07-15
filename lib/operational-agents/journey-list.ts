import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLeadJourney,
  buildPatientJourney,
  filterJourneys,
  type ContactJourney,
  type JourneyActionContext,
  type JourneyEventRef,
  type JourneyListFilters,
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

async function buildActionContext(
  supabase: SupabaseClient,
  clinicId: string
): Promise<JourneyActionContext> {
  const { data: apptPatients } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .in("status", ["agendada", "confirmada", "realizada"]);

  const patientIdsWithAppointment = [
    ...new Set((apptPatients ?? []).map((a) => String(a.patient_id))),
  ];

  const { data: formAppts } = await supabase
    .from("form_instances")
    .select("appointment_id")
    .eq("status", "pending")
    .not("appointment_id", "is", null);

  return {
    patientIdsWithAppointment,
    appointmentIdsNeedingForm: (formAppts ?? []).map((f) => String(f.appointment_id)),
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

  const encounter = encounters.find(
    (e) => String(e.appointment_id) === String(chosen.id)
  );

  return {
    id: String(chosen.id),
    status: String(chosen.status),
    scheduled_at: String(chosen.scheduled_at),
    is_return: slug === "retorno",
    encounter_status: encounter ? String(encounter.status) : null,
    checked_in: Boolean(chosen.checked_in_at),
  };
}

export async function fetchJourneyListForClinic(
  supabase: SupabaseClient,
  clinicId: string,
  filters?: JourneyListFilters
): Promise<ContactJourney[]> {
  const [pipelineRes, pendingEventsRes, formEmailsRes] = await Promise.all([
    supabase
      .from("non_registered_pipeline")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("updated_at", { ascending: false }),
    supabase.rpc("get_pending_events", {
      p_clinic_id: clinicId,
      p_patient_id: null,
      p_event_code: null,
      p_limit: 500,
      p_offset: 0,
      p_secretary_id: null,
    }),
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

  const { data: pipelineQuotes } =
    pipelineIds.length > 0
      ? await supabase
          .from("quotes")
          .select("id, pipeline_id, status, total_amount, created_at")
          .in("pipeline_id", pipelineIds)
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

  const [appointmentsRes, patientQuotesRes, comandasRes, treatmentPlansRes, repescagemRes, realizedApptsRes] =
    await Promise.all([
      patientIds.length > 0
        ? supabase
            .from("appointments")
            .select(
              "id, patient_id, status, scheduled_at, checked_in_at, appointment_type_id, appointment_types(slug, name)"
            )
            .eq("clinic_id", clinicId)
            .in("patient_id", patientIds)
            .in("status", ["agendada", "confirmada", "realizada", "falta", "cancelada"])
            .order("scheduled_at", { ascending: false })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length > 0
        ? supabase
            .from("quotes")
            .select("id, patient_id, status, total_amount, created_at")
            .in("patient_id", patientIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length > 0
        ? supabase
            .from("comandas")
            .select("id, patient_id, appointment_id, status")
            .eq("clinic_id", clinicId)
            .in("patient_id", patientIds)
            .in("status", ["aberta", "parcial", "paga"])
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length > 0
        ? supabase
            .from("treatment_plans")
            .select("id, patient_id, sessions_total, sessions_used, status")
            .eq("clinic_id", clinicId)
            .in("patient_id", patientIds)
            .eq("status", "ativo")
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length > 0
        ? supabase
            .from("lead_repescagem")
            .select("id, patient_id, status, source")
            .eq("clinic_id", clinicId)
            .in("patient_id", patientIds)
            .neq("status", "arquivado")
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length > 0
        ? supabase
            .from("appointments")
            .select("patient_id")
            .eq("clinic_id", clinicId)
            .in("patient_id", patientIds)
            .eq("status", "realizada")
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

  const appointments = appointmentsRes.data ?? [];
  const apptIds = appointments.map((a) => String(a.id));

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

  const allPendingEvents = ((pendingEventsRes.data as Record<string, unknown>[]) ?? []).map(
    mapEvent
  );

  const patientsWithRealized = new Set(
    (realizedApptsRes.data ?? []).map((a) => String(a.patient_id))
  );

  const context = await buildActionContext(supabase, clinicId);
  const historyByPipeline = new Map<string, PipelineLeadInput["history"]>();
  for (const h of historyItems ?? []) {
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

  for (const item of pipelineItems) {
    const leadQuotes = (pipelineQuotes ?? [])
      .filter((q) => String(q.pipeline_id) === String(item.id))
      .map((q) => ({
        id: String(q.id),
        status: String(q.status),
        total_amount: q.total_amount != null ? Number(q.total_amount) : null,
        created_at: String(q.created_at),
      }));

    const lead: PipelineLeadInput = {
      id: String(item.id),
      email: String(item.email),
      name: item.name ? String(item.name) : null,
      phone: item.phone ? String(item.phone) : null,
      stage: String(item.stage),
      lifecycle_stage: item.lifecycle_stage ? String(item.lifecycle_stage) : null,
      source: item.source ? String(item.source) : null,
      loss_reason: item.loss_reason ? String(item.loss_reason) : null,
      lead_score: item.lead_score != null ? Number(item.lead_score) : undefined,
      temperature_override: item.temperature_override
        ? String(item.temperature_override)
        : null,
      updated_at: String(item.updated_at),
      history: historyByPipeline.get(String(item.id)) ?? [],
      hasPublicForm: formEmails.has(String(item.email).toLowerCase().trim()),
      quotes: leadQuotes,
    };
    const events = eventsForLead(lead.email, allPendingEvents);
    journeys.push(buildLeadJourney(lead, events, context));
  }

  for (const patient of patientList) {
    const emailLower = patient.email?.toLowerCase().trim();
    if (emailLower && leadEmails.has(emailLower)) continue;

    const patientId = String(patient.id);
    const appt = pickRelevantAppointment(patientId, appointments, encounters ?? []);
    const apptForms = appt
      ? (formInstances ?? []).filter((fi) => String(fi.appointment_id) === appt.id)
      : [];

    const patientQuotes = (patientQuotesRes.data ?? [])
      .filter((q) => String(q.patient_id) === patientId)
      .map((q) => ({
        id: String(q.id),
        status: String(q.status),
        total_amount: q.total_amount != null ? Number(q.total_amount) : null,
        created_at: String(q.created_at),
      }));

    const patientComandas = (comandasRes.data ?? [])
      .filter((c) => String(c.patient_id) === patientId)
      .map((c) => ({
        id: String(c.id),
        status: String(c.status),
        appointment_id: c.appointment_id ? String(c.appointment_id) : null,
      }));

    const plan = (treatmentPlansRes.data ?? []).find((tp) => String(tp.patient_id) === patientId);
    const treatmentPlan = plan
      ? {
          id: String(plan.id),
          sessions_remaining:
            Number(plan.sessions_total ?? 0) - Number(plan.sessions_used ?? 0),
          status: plan.status ? String(plan.status) : null,
        }
      : null;

    const repRow = (repescagemRes.data ?? []).find((r) => String(r.patient_id) === patientId);
    const repescagem = repRow
      ? {
          id: String(repRow.id),
          status: String(repRow.status),
          source: String(repRow.source),
        }
      : null;

    const patientInput: PatientJourneyInput = {
      id: patientId,
      full_name: String(patient.full_name),
      email: patient.email ? String(patient.email) : null,
      phone: patient.phone ? String(patient.phone) : null,
      updated_at: String(patient.updated_at),
      hasCompletedAppointment: patientsWithRealized.has(patientId),
      lifecycle_stage: patientsWithRealized.has(patientId) ? "cliente" : undefined,
      appointment: appt,
      pendingFormCount: apptForms.filter((f) => String(f.status) !== "respondido").length,
      respondedFormCount: apptForms.filter((f) => String(f.status) === "respondido").length,
      quotes: patientQuotes,
      comandas: patientComandas,
      treatmentPlan,
      repescagem,
    };

    const events = eventsForPatient(patientInput.id, allPendingEvents);
    const built = buildPatientJourney(patientInput, events, context);
    const hasActivity =
      events.length > 0 ||
      appt !== null ||
      patientQuotes.length > 0 ||
      patientComandas.length > 0 ||
      repescagem !== null ||
      ["consulta_agendada", "consulta_confirmada", "formulario_pendente"].includes(
        built.currentStep
      );

    if (hasActivity) {
      journeys.push(built);
    }
  }

  return filterJourneys(journeys, filters ?? {});
}

export async function countPendingByPhase(
  supabase: SupabaseClient,
  clinicId: string
): Promise<Record<string, number>> {
  const journeys = await fetchJourneyListForClinic(supabase, clinicId, {
    withPendingAction: true,
  });
  const counts: Record<string, number> = {};
  for (const j of journeys) {
    counts[j.phase] = (counts[j.phase] ?? 0) + 1;
  }
  return counts;
}
