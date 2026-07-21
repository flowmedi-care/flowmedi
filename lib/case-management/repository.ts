import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AutomationPolicy,
  CaseStatus,
  CaseTask,
  EventCategory,
  ExecutionContext,
  JourneyCase,
  JourneyEventRecord,
  OwnerType,
  PendingDecision,
  ProcessType,
  ProcessTypeCode,
  Workflow,
  WorkflowPhase,
  WorkflowTransition,
  WorkflowVersion,
} from "./types";

type Db = SupabaseClient;

function mapCase(row: Record<string, unknown>): JourneyCase {
  const ownerType = (row.owner_type as OwnerType) || "system";
  const legacyOwner = String(row.owner ?? ownerType);
  return {
    id: String(row.id),
    clinic_id: String(row.clinic_id),
    contact_id: String(row.contact_id),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    patient_id: row.patient_id ? String(row.patient_id) : null,
    process_type_id: row.process_type_id ? String(row.process_type_id) : null,
    workflow_version_id: row.workflow_version_id ? String(row.workflow_version_id) : null,
    phase_id: row.phase_id ? String(row.phase_id) : null,
    owner_type: ownerType,
    owner_id: row.owner_id ? String(row.owner_id) : null,
    owner: legacyOwner,
    pending_decision: (row.pending_decision as PendingDecision | null) ?? null,
    execution_context: (row.execution_context as ExecutionContext) ?? null,
    status: (row.status as CaseStatus) || "active",
    opened_at: String(row.opened_at),
    closed_at: row.closed_at ? String(row.closed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    journey_type: row.journey_type ? String(row.journey_type) : null,
    phase: row.phase ? String(row.phase) : null,
  };
}

function mapTask(row: Record<string, unknown>): CaseTask {
  return {
    id: String(row.id),
    case_id: String(row.case_id),
    clinic_id: String(row.clinic_id),
    type: String(row.type ?? "generic"),
    title: String(row.title),
    status: row.status as CaseTask["status"],
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    assignee_role: row.assignee_role ? String(row.assignee_role) : null,
    due_at: row.due_at ? String(row.due_at) : null,
    source_event_id: row.source_event_id ? String(row.source_event_id) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapEvent(row: Record<string, unknown>): JourneyEventRecord {
  return {
    id: String(row.id),
    clinic_id: String(row.clinic_id),
    case_id: row.case_id ? String(row.case_id) : null,
    category: row.category as EventCategory,
    event_type: String(row.event_type),
    actor: String(row.actor),
    payload: (row.payload as Record<string, unknown>) ?? {},
    evidence: row.evidence ? String(row.evidence) : null,
    created_at: String(row.created_at),
  };
}

export async function listProcessTypes(db: Db): Promise<ProcessType[]> {
  const { data } = await db.from("process_types").select("*").order("name");
  return (data ?? []).map((r) => ({
    id: String(r.id),
    code: r.code as ProcessTypeCode,
    name: String(r.name),
  }));
}

export async function getProcessTypeByCode(
  db: Db,
  code: ProcessTypeCode
): Promise<ProcessType | null> {
  const { data } = await db.from("process_types").select("*").eq("code", code).maybeSingle();
  if (!data) return null;
  return { id: String(data.id), code: data.code as ProcessTypeCode, name: String(data.name) };
}

export async function getPublishedWorkflowVersion(
  db: Db,
  processTypeCode: ProcessTypeCode,
  clinicId?: string | null
): Promise<{
  workflow: Workflow;
  version: WorkflowVersion;
  phases: WorkflowPhase[];
  transitions: WorkflowTransition[];
} | null> {
  const pt = await getProcessTypeByCode(db, processTypeCode);
  if (!pt) return null;

  let wfQuery = db
    .from("workflows")
    .select("*")
    .eq("process_type_id", pt.id)
    .order("created_at", { ascending: true });

  const { data: clinicWfs } = clinicId
    ? await wfQuery.eq("clinic_id", clinicId)
    : { data: [] as Record<string, unknown>[] };

  let wf = (clinicWfs ?? [])[0] as Record<string, unknown> | undefined;
  if (!wf) {
    const { data: sys } = await db
      .from("workflows")
      .select("*")
      .eq("process_type_id", pt.id)
      .is("clinic_id", null)
      .limit(1)
      .maybeSingle();
    wf = sys as Record<string, unknown> | undefined;
  }
  if (!wf) return null;

  const { data: wv } = await db
    .from("workflow_versions")
    .select("*")
    .eq("workflow_id", wf.id)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!wv) return null;

  const [phasesRes, transRes] = await Promise.all([
    db
      .from("workflow_phases")
      .select("*")
      .eq("workflow_version_id", wv.id)
      .order("sort_order"),
    db.from("workflow_transitions").select("*").eq("workflow_version_id", wv.id),
  ]);

  return {
    workflow: {
      id: String(wf.id),
      clinic_id: wf.clinic_id ? String(wf.clinic_id) : null,
      process_type_id: String(wf.process_type_id),
      code: String(wf.code),
      name: String(wf.name),
    },
    version: {
      id: String(wv.id),
      workflow_id: String(wv.workflow_id),
      version: Number(wv.version),
      status: wv.status as WorkflowVersion["status"],
      automation_policy: (wv.automation_policy as AutomationPolicy) ?? {},
    },
    phases: (phasesRes.data ?? []).map((p) => ({
      id: String(p.id),
      workflow_version_id: String(p.workflow_version_id),
      code: String(p.code),
      name: String(p.name),
      sort_order: Number(p.sort_order),
      terminal: Boolean(p.terminal),
    })),
    transitions: (transRes.data ?? []).map((t) => ({
      id: String(t.id),
      workflow_version_id: String(t.workflow_version_id),
      from_phase_id: String(t.from_phase_id),
      to_phase_id: String(t.to_phase_id),
      trigger_type: t.trigger_type as WorkflowTransition["trigger_type"],
      trigger_ref: t.trigger_ref ? String(t.trigger_ref) : null,
      conditions: (t.conditions as Record<string, unknown>) ?? {},
      actions: (t.actions as unknown[]) ?? [],
    })),
  };
}

export async function getPhasesForVersion(
  db: Db,
  workflowVersionId: string
): Promise<WorkflowPhase[]> {
  const { data } = await db
    .from("workflow_phases")
    .select("*")
    .eq("workflow_version_id", workflowVersionId)
    .order("sort_order");
  return (data ?? []).map((p) => ({
    id: String(p.id),
    workflow_version_id: String(p.workflow_version_id),
    code: String(p.code),
    name: String(p.name),
    sort_order: Number(p.sort_order),
    terminal: Boolean(p.terminal),
  }));
}

export async function getTransitionsForVersion(
  db: Db,
  workflowVersionId: string
): Promise<WorkflowTransition[]> {
  const { data } = await db
    .from("workflow_transitions")
    .select("*")
    .eq("workflow_version_id", workflowVersionId);
  return (data ?? []).map((t) => ({
    id: String(t.id),
    workflow_version_id: String(t.workflow_version_id),
    from_phase_id: String(t.from_phase_id),
    to_phase_id: String(t.to_phase_id),
    trigger_type: t.trigger_type as WorkflowTransition["trigger_type"],
    trigger_ref: t.trigger_ref ? String(t.trigger_ref) : null,
    conditions: (t.conditions as Record<string, unknown>) ?? {},
    actions: (t.actions as unknown[]) ?? [],
  }));
}

export async function listPublishedWorkflows(db: Db, clinicId?: string | null) {
  const { data: wfs } = await db
    .from("workflows")
    .select("*, process_types(code, name)")
    .or(clinicId ? `clinic_id.is.null,clinic_id.eq.${clinicId}` : "clinic_id.is.null");

  const out: {
    workflow: Workflow;
    process_type_code: string;
    process_type_name: string;
    version_id: string;
  }[] = [];

  for (const w of wfs ?? []) {
    const { data: wv } = await db
      .from("workflow_versions")
      .select("id")
      .eq("workflow_id", w.id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!wv) continue;
    const pt = Array.isArray(w.process_types) ? w.process_types[0] : w.process_types;
    out.push({
      workflow: {
        id: String(w.id),
        clinic_id: w.clinic_id ? String(w.clinic_id) : null,
        process_type_id: String(w.process_type_id),
        code: String(w.code),
        name: String(w.name),
      },
      process_type_code: String(pt?.code ?? ""),
      process_type_name: String(pt?.name ?? ""),
      version_id: String(wv.id),
    });
  }
  return out;
}

export async function getCaseById(db: Db, caseId: string): Promise<JourneyCase | null> {
  const { data, error } = await db.from("journey_cases").select("*").eq("id", caseId).maybeSingle();
  if (error || !data) return null;
  return mapCase(data as Record<string, unknown>);
}

export async function getOpenCaseByContact(
  db: Db,
  clinicId: string,
  contactId: string
): Promise<JourneyCase | null> {
  const { data, error } = await db
    .from("journey_cases")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("contact_id", contactId)
    .in("status", ["active", "waiting", "open"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapCase(data as Record<string, unknown>);
}

export async function listCasesForClinic(
  db: Db,
  clinicId: string,
  opts?: { status?: CaseStatus[]; workflowVersionId?: string }
): Promise<JourneyCase[]> {
  let q = db.from("journey_cases").select("*").eq("clinic_id", clinicId);
  if (opts?.status?.length) q = q.in("status", opts.status);
  if (opts?.workflowVersionId) q = q.eq("workflow_version_id", opts.workflowVersionId);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(500);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapCase);
}

export async function insertCase(
  db: Db,
  input: {
    clinic_id: string;
    contact_id: string;
    lead_id?: string | null;
    patient_id?: string | null;
    process_type_code?: ProcessTypeCode;
    owner_type?: OwnerType;
    owner_id?: string | null;
  }
): Promise<JourneyCase | null> {
  const code = input.process_type_code ?? "primeira_consulta";
  const pub = await getPublishedWorkflowVersion(db, code, input.clinic_id);
  const firstPhase = pub?.phases[0];

  const { data, error } = await db
    .from("journey_cases")
    .insert({
      clinic_id: input.clinic_id,
      contact_id: input.contact_id,
      lead_id: input.lead_id ?? null,
      patient_id: input.patient_id ?? null,
      journey_type: code,
      phase: firstPhase?.code ?? "captacao",
      process_type_id: pub?.workflow.process_type_id ?? null,
      workflow_version_id: pub?.version.id ?? null,
      phase_id: firstPhase?.id ?? null,
      owner_type: input.owner_type ?? "system",
      owner_id: input.owner_id ?? null,
      owner: input.owner_type ?? "system",
      status: "active",
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapCase(data as Record<string, unknown>);
}

export async function updateCaseFields(
  db: Db,
  caseId: string,
  patch: Partial<{
    phase_id: string;
    phase: string;
    owner_type: OwnerType;
    owner_id: string | null;
    owner: string;
    pending_decision: PendingDecision | null;
    execution_context: ExecutionContext;
    status: CaseStatus;
    closed_at: string | null;
    lead_id: string | null;
    patient_id: string | null;
  }>
): Promise<JourneyCase | null> {
  const { data, error } = await db
    .from("journey_cases")
    .update(patch)
    .eq("id", caseId)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapCase(data as Record<string, unknown>);
}

export async function countOpenTasks(db: Db, caseId: string): Promise<number> {
  const { count } = await db
    .from("case_tasks")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("status", "open");
  return count ?? 0;
}

export async function listTasksForCase(db: Db, caseId: string): Promise<CaseTask[]> {
  const { data, error } = await db
    .from("case_tasks")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapTask);
}

export async function insertTask(
  db: Db,
  input: {
    case_id: string;
    clinic_id: string;
    title: string;
    type?: string;
    assigned_to?: string | null;
    assignee_role?: string | null;
    due_at?: string | null;
    source_event_id?: string | null;
  }
): Promise<CaseTask | null> {
  const { data, error } = await db
    .from("case_tasks")
    .insert({
      case_id: input.case_id,
      clinic_id: input.clinic_id,
      title: input.title,
      type: input.type ?? "generic",
      assigned_to: input.assigned_to ?? null,
      assignee_role: input.assignee_role ?? null,
      due_at: input.due_at ?? null,
      source_event_id: input.source_event_id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapTask(data as Record<string, unknown>);
}

export async function completeTask(db: Db, taskId: string): Promise<CaseTask | null> {
  const { data, error } = await db
    .from("case_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapTask(data as Record<string, unknown>);
}

export async function insertEvent(
  db: Db,
  input: {
    clinic_id: string;
    case_id?: string | null;
    category: EventCategory;
    event_type: string;
    actor: string;
    payload?: Record<string, unknown>;
    evidence?: string | null;
  }
): Promise<JourneyEventRecord | null> {
  const { data, error } = await db
    .from("journey_events")
    .insert({
      clinic_id: input.clinic_id,
      case_id: input.case_id ?? null,
      category: input.category,
      event_type: input.event_type,
      actor: input.actor,
      payload: input.payload ?? {},
      evidence: input.evidence ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapEvent(data as Record<string, unknown>);
}

export async function listEventsForCase(
  db: Db,
  caseId: string,
  limit = 100
): Promise<JourneyEventRecord[]> {
  const { data, error } = await db
    .from("journey_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapEvent);
}

export async function listDomainEventsForCase(
  db: Db,
  caseId: string
): Promise<JourneyEventRecord[]> {
  const { data, error } = await db
    .from("journey_events")
    .select("*")
    .eq("case_id", caseId)
    .eq("category", "domain")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapEvent);
}
