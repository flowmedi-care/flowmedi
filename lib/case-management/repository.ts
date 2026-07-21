import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CaseTask,
  EventCategory,
  JourneyCase,
  JourneyEventRecord,
  JourneyType,
  CasePhase,
  CaseStatus,
  PendingDecision,
} from "./types";

type Db = SupabaseClient;

function mapCase(row: Record<string, unknown>): JourneyCase {
  return {
    id: String(row.id),
    clinic_id: String(row.clinic_id),
    contact_id: String(row.contact_id),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    patient_id: row.patient_id ? String(row.patient_id) : null,
    journey_type: row.journey_type as JourneyType,
    phase: row.phase as CasePhase,
    owner: String(row.owner ?? "system"),
    pending_decision: (row.pending_decision as PendingDecision | null) ?? null,
    status: row.status as CaseStatus,
    opened_at: String(row.opened_at),
    closed_at: row.closed_at ? String(row.closed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapTask(row: Record<string, unknown>): CaseTask {
  return {
    id: String(row.id),
    case_id: String(row.case_id),
    clinic_id: String(row.clinic_id),
    title: String(row.title),
    status: row.status as CaseTask["status"],
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

export async function getCaseById(
  db: Db,
  caseId: string
): Promise<JourneyCase | null> {
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
    .in("status", ["open", "waiting"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapCase(data as Record<string, unknown>);
}

export async function listCasesForClinic(
  db: Db,
  clinicId: string,
  opts?: { status?: CaseStatus[] }
): Promise<JourneyCase[]> {
  let q = db.from("journey_cases").select("*").eq("clinic_id", clinicId);
  if (opts?.status?.length) q = q.in("status", opts.status);
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
    journey_type?: JourneyType;
    phase?: CasePhase;
    owner?: string;
    status?: CaseStatus;
  }
): Promise<JourneyCase | null> {
  const { data, error } = await db
    .from("journey_cases")
    .insert({
      clinic_id: input.clinic_id,
      contact_id: input.contact_id,
      lead_id: input.lead_id ?? null,
      patient_id: input.patient_id ?? null,
      journey_type: input.journey_type ?? "primeira_consulta",
      phase: input.phase ?? "captacao",
      owner: input.owner ?? "system",
      status: input.status ?? "open",
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
    phase: CasePhase;
    owner: string;
    pending_decision: PendingDecision | null;
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
      assignee_role: input.assignee_role ?? null,
      due_at: input.due_at ?? null,
      source_event_id: input.source_event_id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapTask(data as Record<string, unknown>);
}

export async function completeTask(
  db: Db,
  taskId: string
): Promise<CaseTask | null> {
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
