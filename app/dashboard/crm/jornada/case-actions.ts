"use server";

import { createClient } from "@/lib/supabase/server";
import {
  applyTransition,
  buildAiQueueProjection,
  buildAttendanceProjectionFromAppointments,
  buildFluxoProjection,
  buildPendingQueueProjection,
  buildTimelineProjection,
  buildWorkspaceContext,
  countOpenTasks,
  getCaseById,
  getPhasesForVersion,
  listCasesForClinic,
  listEventsForCase,
  listPublishedWorkflows,
  listTasksForCase,
  publishDomainEvent,
  type AttendanceCard,
  type BoardView,
  type CaseEnrichment,
  type CaseStatus,
} from "@/lib/case-management";
import type { BoardPayload, WorkspacePayload } from "./case-types";

async function requireClinic() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." as const, supabase, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role, id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { error: "Clínica não encontrada." as const, supabase, profile: null };
  }
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão." as const, supabase, profile: null };
  }
  return { error: null, supabase, profile };
}

async function buildEnrichment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  cases: Awaited<ReturnType<typeof listCasesForClinic>>
): Promise<Record<string, CaseEnrichment>> {
  const leadIds = cases.map((c) => c.lead_id).filter(Boolean) as string[];
  const patientIds = cases.map((c) => c.patient_id).filter(Boolean) as string[];

  const [leadsRes, patientsRes, quotesRes] = await Promise.all([
    leadIds.length
      ? supabase
          .from("non_registered_pipeline")
          .select("id, name, email, phone")
          .eq("clinic_id", clinicId)
          .in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null; phone: string | null }[] }),
    patientIds.length
      ? supabase
          .from("patients")
          .select("id, full_name")
          .eq("clinic_id", clinicId)
          .in("id", patientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    leadIds.length
      ? supabase
          .from("quotes")
          .select("id, pipeline_id, status, created_at")
          .in("pipeline_id", leadIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as { pipeline_id: string; status: string }[] }),
  ]);

  const leadMap = new Map(
    (leadsRes.data ?? []).map((l) => [l.id, l.name || l.email || l.phone || "Lead"])
  );
  const patientMap = new Map((patientsRes.data ?? []).map((p) => [p.id, p.full_name]));
  const quoteByLead = new Map<string, string>();
  for (const q of quotesRes.data ?? []) {
    if (q.pipeline_id && !quoteByLead.has(q.pipeline_id)) {
      quoteByLead.set(q.pipeline_id, String(q.status));
    }
  }

  const quoteLabels: Record<string, string> = {
    rascunho: "Orçamento rascunho",
    enviado: "Orçamento enviado",
    aceito: "Aceitou valor",
    recusado: "Não aceitou",
    expirado: "Orçamento expirado",
  };

  const out: Record<string, CaseEnrichment> = {};
  for (const c of cases) {
    const name =
      (c.patient_id && patientMap.get(c.patient_id)) ||
      (c.lead_id && leadMap.get(c.lead_id)) ||
      c.contact_id;
    const qStatus = c.lead_id ? quoteByLead.get(c.lead_id) : null;
    const openTaskCount = await countOpenTasks(supabase, c.id);
    out[c.id] = {
      displayName: name,
      quoteBadge: qStatus ? quoteLabels[qStatus] ?? qStatus : null,
      openTaskCount,
    };
  }
  return out;
}

export async function getCaseBoard(
  view: BoardView = "pendencias",
  workflowVersionId?: string | null
): Promise<{ data: BoardPayload | null; error: string | null }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { data: null, error: ctx.error ?? "Erro" };

  const workflows = await listPublishedWorkflows(ctx.supabase, ctx.profile.clinic_id);
  const selectedVersionId =
    workflowVersionId ||
    workflows.find((w) => w.workflow.code.includes("primeira_consulta"))?.version_id ||
    workflows[0]?.version_id ||
    null;

  const statuses: CaseStatus[] = ["active", "waiting", "completed", "cancelled"];
  const cases = await listCasesForClinic(ctx.supabase, ctx.profile.clinic_id, {
    status: statuses,
    workflowVersionId: view === "fluxo" && selectedVersionId ? selectedVersionId : undefined,
  });

  const enrichment = await buildEnrichment(ctx.supabase, ctx.profile.clinic_id, cases);
  const phases = selectedVersionId
    ? await getPhasesForVersion(ctx.supabase, selectedVersionId)
    : [];

  const fluxoCases =
    view === "fluxo" && selectedVersionId
      ? cases.filter((c) => c.workflow_version_id === selectedVersionId)
      : cases;

  // Comparecimento: appointment grain
  const now = Date.now();
  const { data: appts } = await ctx.supabase
    .from("appointments")
    .select("id, status, scheduled_at, patient_id, patients(full_name), doctors(full_name)")
    .eq("clinic_id", ctx.profile.clinic_id)
    .in("status", ["agendada", "confirmada", "realizada", "falta", "cancelada"])
    .order("scheduled_at", { ascending: true })
    .limit(300);

  const attendanceCards: AttendanceCard[] = [];
  for (const a of appts ?? []) {
    const scheduled = new Date(a.scheduled_at).getTime();
    const st = String(a.status);
    const active = st === "agendada" || st === "confirmada";
    if (active) {
      if (scheduled < now - 7 * 86400000 || scheduled > now + 30 * 86400000) continue;
    } else if (scheduled < now - 14 * 86400000) continue;

    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const doctor = Array.isArray(a.doctors) ? a.doctors[0] : a.doctors;
    const patientId = a.patient_id ? String(a.patient_id) : null;
    const linked = patientId
      ? cases.find((c) => c.patient_id === patientId && (c.status === "active" || c.status === "waiting"))
      : null;

    attendanceCards.push({
      appointmentId: String(a.id),
      caseId: linked?.id ?? null,
      displayName: (patient as { full_name?: string } | null)?.full_name ?? "Paciente",
      status: st,
      scheduledAt: String(a.scheduled_at),
      doctorName: (doctor as { full_name?: string } | null)?.full_name ?? null,
    });
  }

  return {
    error: null,
    data: {
      view,
      workflowVersionId: selectedVersionId,
      workflows: workflows.map((w) => ({
        workflow_id: w.workflow.id,
        version_id: w.version_id,
        name: w.workflow.name,
        process_type_name: w.process_type_name,
      })),
      phases,
      fluxo: buildFluxoProjection(fluxoCases, phases, enrichment),
      comparecimento: buildAttendanceProjectionFromAppointments(attendanceCards),
      aiQueue: buildAiQueueProjection(cases, enrichment),
      pendingQueue: buildPendingQueueProjection(cases, enrichment),
    },
  };
}

export async function getCaseWorkspace(caseId: string): Promise<{
  data: WorkspacePayload | null;
  error: string | null;
}> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { data: null, error: ctx.error ?? "Erro" };

  const journeyCase = await getCaseById(ctx.supabase, caseId);
  if (!journeyCase || journeyCase.clinic_id !== ctx.profile.clinic_id) {
    return { data: null, error: "Case não encontrado." };
  }

  let displayName = journeyCase.contact_id;
  if (journeyCase.patient_id) {
    const { data: p } = await ctx.supabase
      .from("patients")
      .select("full_name")
      .eq("id", journeyCase.patient_id)
      .maybeSingle();
    if (p?.full_name) displayName = p.full_name;
  } else if (journeyCase.lead_id) {
    const { data: l } = await ctx.supabase
      .from("non_registered_pipeline")
      .select("name, email")
      .eq("id", journeyCase.lead_id)
      .maybeSingle();
    displayName = l?.name || l?.email || displayName;
  }

  let nextAppointmentLabel: string | null = null;
  let quoteBadge: string | null = null;

  if (journeyCase.lead_id) {
    const { data: quote } = await ctx.supabase
      .from("quotes")
      .select("status")
      .eq("pipeline_id", journeyCase.lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (quote?.status) {
      const quoteLabels: Record<string, string> = {
        rascunho: "Orçamento rascunho",
        enviado: "Orçamento enviado",
        aceito: "Aceitou valor",
        recusado: "Não aceitou",
        expirado: "Orçamento expirado",
      };
      quoteBadge = quoteLabels[String(quote.status)] ?? String(quote.status);
    }
  }

  if (journeyCase.patient_id) {
    const { data: appt } = await ctx.supabase
      .from("appointments")
      .select("scheduled_at, status")
      .eq("patient_id", journeyCase.patient_id)
      .in("status", ["agendada", "confirmada"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (appt?.scheduled_at) {
      nextAppointmentLabel = `Consulta ${new Date(appt.scheduled_at).toLocaleString("pt-BR")} (${appt.status})`;
    }
  }

  const ws = await buildWorkspaceContext(ctx.supabase, caseId, {
    displayName,
    nextAppointmentLabel,
    quoteBadge,
  });
  if (!ws) return { data: null, error: "Falha ao montar workspace." };

  const events = await listEventsForCase(ctx.supabase, caseId, 80);

  return {
    error: null,
    data: {
      case: ws.case,
      header: ws.header,
      tasks: ws.tasks,
      timeline: buildTimelineProjection(events).events as WorkspacePayload["timeline"],
      primaryPanels: ws.primaryPanels,
      priorityActions: ws.priorityActions,
    },
  };
}

export async function requestCasePhaseOverride(
  caseId: string,
  toPhaseId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { ok: false, error: ctx.error ?? "Erro" };

  const result = await applyTransition(ctx.supabase, {
    caseId,
    actor: `human:${ctx.profile.id}`,
    triggerType: "manual",
    toPhaseId,
    evidence: reason ?? "fluxo_dnd",
  });
  if (!result.ok) return { ok: false, error: result.reason };
  return { ok: true };
}

export async function completeCaseTaskAction(
  caseId: string,
  taskId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { ok: false, error: ctx.error ?? "Erro" };
  const { completeTask } = await import("@/lib/case-management/repository");
  const task = await completeTask(ctx.supabase, taskId);
  if (!task) return { ok: false, error: "task_complete_failed" };
  await publishDomainEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    caseId,
    eventType: "Task.Completed",
    actor: `human:${ctx.profile.id}`,
    payload: { task_id: taskId },
  });
  return { ok: true };
}

export async function publishCaseOutcomeAction(input: {
  caseId: string;
  eventType: string;
  evidence?: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { ok: false, error: ctx.error ?? "Erro" };

  const result = await publishDomainEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    caseId: input.caseId,
    eventType: input.eventType,
    actor: `human:${ctx.profile.id}`,
    payload: input.payload ?? {},
    evidence: input.evidence ?? null,
  });
  if (result.rejected) return { ok: false, error: result.rejected };
  return { ok: true };
}

export async function changeAttendanceStatus(
  appointmentId: string,
  newStatus: "agendada" | "confirmada" | "realizada" | "falta" | "cancelada"
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { ok: false, error: ctx.error ?? "Erro" };

  const { updateAppointment } = await import("@/app/dashboard/agenda/actions");
  const result = await updateAppointment(appointmentId, { status: newStatus });
  if (result.error) return { ok: false, error: result.error };

  const eventMap = {
    agendada: "Appointment.Created",
    confirmada: "Appointment.Confirmed",
    realizada: "Appointment.Completed",
    falta: "Appointment.NoShow",
    cancelada: "Appointment.Cancelled",
  } as const;

  const { data: appt } = await ctx.supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (appt?.patient_id) {
    const { contactIdFromPatient, getOpenCaseByContact } = await import(
      "@/lib/case-management"
    );
    const contactId = contactIdFromPatient(String(appt.patient_id));
    const open = await getOpenCaseByContact(
      ctx.supabase,
      ctx.profile.clinic_id,
      contactId
    );
    await publishDomainEvent(ctx.supabase, {
      clinicId: ctx.profile.clinic_id,
      caseId: open?.id ?? null,
      contactId,
      patientId: String(appt.patient_id),
      eventType: eventMap[newStatus],
      actor: `human:${ctx.profile.id}`,
      payload: { appointment_id: appointmentId },
      ensureCase: { process_type_code: "primeira_consulta" },
    });
  }
  return { ok: true };
}
