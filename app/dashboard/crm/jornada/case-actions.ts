"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CASE_PHASE_LABELS,
  JOURNEY_TYPE_LABELS,
  PHASE_DEFAULT_OBJECTIVE,
  buildAiQueueProjection,
  buildAttendanceProjection,
  buildFinanceProjection,
  buildPendingQueueProjection,
  buildPipelineProjection,
  buildTimelineProjection,
  buildWorkspaceContext,
  contactIdFromLead,
  getCaseById,
  listCasesForClinic,
  listEventsForCase,
  listTasksForCase,
  publishDomainEvent,
  type BoardView,
  type CaseEnrichment,
  type CasePhase,
  type CaseTask,
  type JourneyCase,
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
  cases: JourneyCase[]
): Promise<Record<string, CaseEnrichment>> {
  const leadIds = cases.map((c) => c.lead_id).filter(Boolean) as string[];
  const patientIds = cases.map((c) => c.patient_id).filter(Boolean) as string[];

  const [leadsRes, patientsRes, apptsRes] = await Promise.all([
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
    patientIds.length
      ? supabase
          .from("appointments")
          .select("id, patient_id, status, scheduled_at")
          .eq("clinic_id", clinicId)
          .in("patient_id", patientIds)
          .in("status", ["agendada", "confirmada", "realizada", "falta", "cancelada"])
          .order("scheduled_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as { id: string; patient_id: string; status: string; scheduled_at: string }[] }),
  ]);

  const leadMap = new Map(
    (leadsRes.data ?? []).map((l) => [l.id, l.name || l.email || l.phone || "Lead"])
  );
  const patientMap = new Map((patientsRes.data ?? []).map((p) => [p.id, p.full_name]));
  const apptByPatient = new Map<string, string>();
  for (const a of apptsRes.data ?? []) {
    if (!apptByPatient.has(a.patient_id)) apptByPatient.set(a.patient_id, a.status);
  }

  const out: Record<string, CaseEnrichment> = {};
  for (const c of cases) {
    const name =
      (c.patient_id && patientMap.get(c.patient_id)) ||
      (c.lead_id && leadMap.get(c.lead_id)) ||
      c.contact_id;
    out[c.id] = {
      displayName: name,
      appointmentStatus: c.patient_id ? apptByPatient.get(c.patient_id) ?? null : null,
      financeStatus: c.phase === "financeiro" ? "aberto" : c.phase === "pos" || c.phase === "fechado" ? "pago" : "nenhum",
    };
  }
  return out;
}

export async function getCaseBoard(view: BoardView = "pipeline"): Promise<{
  data: BoardPayload | null;
  error: string | null;
}> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { data: null, error: ctx.error ?? "Erro" };

  const cases = await listCasesForClinic(ctx.supabase, ctx.profile.clinic_id, {
    status: ["open", "waiting", "closed"],
  });
  const openish = cases.filter((c) => c.status !== "closed" || c.phase === "perdido");

  const allTasks: CaseTask[] = [];
  for (const c of openish.slice(0, 100)) {
    const tasks = await listTasksForCase(ctx.supabase, c.id);
    allTasks.push(...tasks);
  }

  const enrichment = await buildEnrichment(ctx.supabase, ctx.profile.clinic_id, openish);

  return {
    error: null,
    data: {
      view,
      pipeline: buildPipelineProjection(openish, enrichment, allTasks),
      attendance: buildAttendanceProjection(openish, enrichment, allTasks),
      finance: buildFinanceProjection(openish, enrichment, allTasks),
      aiQueue: buildAiQueueProjection(openish, enrichment, allTasks),
      pendingQueue: buildPendingQueueProjection(openish, enrichment, allTasks),
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

  const [tasks, events, enrichment] = await Promise.all([
    listTasksForCase(ctx.supabase, caseId),
    listEventsForCase(ctx.supabase, caseId, 80),
    buildEnrichment(ctx.supabase, ctx.profile.clinic_id, [journeyCase]),
  ]);

  const workspaceCtx = buildWorkspaceContext(journeyCase);

  return {
    error: null,
    data: {
      case: journeyCase,
      tasks,
      timeline: buildTimelineProjection(events).events,
      context: workspaceCtx,
      displayName: enrichment[journeyCase.id]?.displayName ?? journeyCase.contact_id,
      phaseLabel: CASE_PHASE_LABELS[journeyCase.phase],
      journeyTypeLabel: JOURNEY_TYPE_LABELS[journeyCase.journey_type],
      objective: PHASE_DEFAULT_OBJECTIVE[journeyCase.phase],
      labels: { phases: CASE_PHASE_LABELS },
    },
  };
}

/** DnD / override humano → Domain Event (não escreve phase direto). */
export async function requestCasePhaseOverride(
  caseId: string,
  targetPhase: CasePhase,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { ok: false, error: ctx.error ?? "Erro" };

  const journeyCase = await getCaseById(ctx.supabase, caseId);
  if (!journeyCase || journeyCase.clinic_id !== ctx.profile.clinic_id) {
    return { ok: false, error: "Case não encontrado." };
  }

  const result = await publishDomainEvent(ctx.supabase, {
    clinicId: ctx.profile.clinic_id,
    caseId,
    eventType: "Case.OverrideRequested",
    actor: `human:${ctx.profile.id}`,
    payload: { target_phase: targetPhase, reason: reason ?? "board_dnd" },
    evidence: reason ?? "override via board",
  });

  if (result.rejected) return { ok: false, error: result.rejected };
  return { ok: true };
}

export async function completeCaseTaskAction(
  caseId: string,
  taskId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { ok: false, error: ctx.error ?? "Erro" };

  const { dispatchCommand } = await import("@/lib/case-management/transition/engine");
  const result = await dispatchCommand(
    ctx.supabase,
    { type: "CompleteTask", caseId, taskId },
    `human:${ctx.profile.id}`
  );
  if (!result.ok) return { ok: false, error: result.reason };
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

  const journeyCase = await getCaseById(ctx.supabase, input.caseId);
  if (!journeyCase || journeyCase.clinic_id !== ctx.profile.clinic_id) {
    return { ok: false, error: "Case não encontrado." };
  }

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

export async function ensureCaseForLead(leadId: string): Promise<{
  caseId: string | null;
  error: string | null;
}> {
  const ctx = await requireClinic();
  if (ctx.error || !ctx.profile) return { caseId: null, error: ctx.error ?? "Erro" };

  const contactId = contactIdFromLead(leadId);
  const { getOpenCaseByContact, insertCase } = await import("@/lib/case-management");
  let existing = await getOpenCaseByContact(ctx.supabase, ctx.profile.clinic_id, contactId);
  if (!existing) {
    existing = await insertCase(ctx.supabase, {
      clinic_id: ctx.profile.clinic_id,
      contact_id: contactId,
      lead_id: leadId,
    });
  }
  return { caseId: existing?.id ?? null, error: existing ? null : "Falha ao criar case" };
}
