/**
 * projectOperationalDashboard — projeção pura + loaders.
 * Domínio inalterado: Cases + next_decision + appointments + leads.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyCase } from "@/lib/case-management/types";
import {
  actionGroupLabel,
  getCaseNextDecision,
  ownerTypeToActor,
  type DecisionActor,
} from "@/lib/case-management/next-decision";
import type {
  CaseProjectionItem,
  JourneyTypeCode,
  OperationalProjection,
  OpsBoardStage,
  OpsPanoramaSlice,
  PanoramaCounts,
  WorkActionGroup,
  WorkToday,
} from "./types";

type Db = SupabaseClient;

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function mapJourneyType(code: string | null | undefined): JourneyTypeCode {
  const c = (code || "").toLowerCase();
  if (
    c === "primeira_consulta" ||
    c === "retorno" ||
    c === "tratamento" ||
    c === "reativacao" ||
    c === "suporte" ||
    c === "orcamento"
  ) {
    return c;
  }
  return "unknown";
}

function phaseToBoardStage(
  journeyType: JourneyTypeCode,
  phaseCode: string | null,
  apptStatus: string | null,
  scheduledAt: string | null,
  nextAction: string | null,
  now: Date
): { stage: OpsBoardStage | null; slice: OpsPanoramaSlice | null } {
  // Appointment-driven (Atendimentos)
  if (apptStatus === "falta") {
    return { stage: "falta", slice: "atendimentos" };
  }
  if (apptStatus === "realizada") {
    if (journeyType === "tratamento") return { stage: "tratamento", slice: "pacientes" };
    if (journeyType === "retorno") return { stage: "retorno", slice: "pacientes" };
    if (journeyType === "reativacao") return { stage: "reativacao", slice: "pacientes" };
    return { stage: "pos_consulta", slice: "pacientes" };
  }
  if (apptStatus === "em_atendimento" || apptStatus === "em atendimento") {
    return { stage: "em_atendimento", slice: "atendimentos" };
  }
  if (apptStatus === "confirmada" || apptStatus === "agendada") {
    if (scheduledAt) {
      const s = new Date(scheduledAt);
      if (s >= startOfDay(now) && s <= endOfDay(now)) {
        return { stage: "hoje", slice: "atendimentos" };
      }
    }
    if (
      apptStatus === "agendada" ||
      nextAction === "confirm_slot" ||
      nextAction === "confirm_appointment"
    ) {
      return { stage: "confirmar", slice: "atendimentos" };
    }
    return { stage: "hoje", slice: "atendimentos" };
  }

  // Jornadas tipadas (Pacientes) — antes de fases comerciais genéricas
  if (journeyType === "tratamento") {
    return { stage: "tratamento", slice: "pacientes" };
  }
  if (journeyType === "retorno") {
    return { stage: "retorno", slice: "pacientes" };
  }
  if (journeyType === "reativacao") {
    return { stage: "reativacao", slice: "pacientes" };
  }

  if (nextAction === "reschedule") {
    return { stage: "reagendar", slice: "agenda" };
  }
  if (
    nextAction === "advance_commercial" ||
    phaseCode === "comercial" ||
    phaseCode === "agendamento"
  ) {
    return { stage: "agendar", slice: "agenda" };
  }

  if (phaseCode === "perdido") return { stage: "perdido", slice: "pessoas" };
  if (phaseCode === "alta" || phaseCode === "fechado" || phaseCode === "cliente") {
    return { stage: "cliente", slice: "pessoas" };
  }
  if (phaseCode === "pos") return { stage: "pos_consulta", slice: "pacientes" };
  if (phaseCode === "consulta") return { stage: "confirmar", slice: "atendimentos" };
  if (phaseCode === "captacao" || phaseCode === "cadastro") {
    return { stage: "contato_novo", slice: "pessoas" };
  }
  if (phaseCode === "qualificado" || phaseCode === "orcamento") {
    return { stage: "qualificado", slice: "pessoas" };
  }

  if (journeyType === "primeira_consulta" || journeyType === "unknown") {
    return { stage: "qualificacao", slice: "pessoas" };
  }

  return { stage: null, slice: null };
}

function emptyPanorama(): PanoramaCounts {
  return {
    pessoas: { novo: 0, qualificacao: 0, qualificado: 0, cliente: 0, perdido: 0 },
    agenda: { agendar: 0, reagendar: 0 },
    atendimentos: { confirmar: 0, hoje: 0, em_atendimento: 0, realizada: 0, falta: 0 },
    pacientes: { pos_consulta: 0, tratamento: 0, retorno: 0, reativacao: 0 },
  };
}

function bumpPanorama(p: PanoramaCounts, stage: OpsBoardStage | null) {
  if (!stage) return;
  switch (stage) {
    case "contato_novo":
      p.pessoas.novo += 1;
      break;
    case "qualificacao":
      p.pessoas.qualificacao += 1;
      break;
    case "qualificado":
      p.pessoas.qualificado += 1;
      break;
    case "cliente":
      p.pessoas.cliente += 1;
      break;
    case "perdido":
      p.pessoas.perdido += 1;
      break;
    case "agendar":
      p.agenda.agendar += 1;
      break;
    case "reagendar":
      p.agenda.reagendar += 1;
      break;
    case "confirmar":
      p.atendimentos.confirmar += 1;
      break;
    case "hoje":
      p.atendimentos.hoje += 1;
      break;
    case "em_atendimento":
      p.atendimentos.em_atendimento += 1;
      break;
    case "realizada":
      p.atendimentos.realizada += 1;
      break;
    case "falta":
      p.atendimentos.falta += 1;
      break;
    case "pos_consulta":
      p.pacientes.pos_consulta += 1;
      break;
    case "tratamento":
      p.pacientes.tratamento += 1;
      break;
    case "retorno":
      p.pacientes.retorno += 1;
      break;
    case "reativacao":
      p.pacientes.reativacao += 1;
      break;
  }
}

type ApptRow = {
  id: string;
  status: string;
  scheduled_at: string;
  patient_id: string | null;
};

type NameMaps = {
  byPatientId: Record<string, string>;
  byLeadId: Record<string, string>;
  phaseCodeById: Record<string, string>;
  processCodeById: Record<string, string>;
};

export function buildOperationalProjection(input: {
  cases: JourneyCase[];
  appointments: ApptRow[];
  names: NameMaps;
  now?: Date;
}): OperationalProjection {
  const now = input.now ?? new Date();
  const dayStart = startOfDay(now).getTime();
  const dayEnd = endOfDay(now).getTime();

  // Prefer nearest future / today appointment per patient
  const apptByPatient = new Map<string, ApptRow>();
  for (const a of input.appointments) {
    if (!a.patient_id) continue;
    const prev = apptByPatient.get(a.patient_id);
    if (!prev) {
      apptByPatient.set(a.patient_id, a);
      continue;
    }
    const aT = new Date(a.scheduled_at).getTime();
    const pT = new Date(prev.scheduled_at).getTime();
    // Prefer today's, else nearest upcoming, else most recent
    const aToday = aT >= dayStart && aT <= dayEnd;
    const pToday = pT >= dayStart && pT <= dayEnd;
    if (aToday && !pToday) apptByPatient.set(a.patient_id, a);
    else if (aToday === pToday && Math.abs(aT - now.getTime()) < Math.abs(pT - now.getTime())) {
      apptByPatient.set(a.patient_id, a);
    }
  }

  const panorama = emptyPanorama();
  const items: CaseProjectionItem[] = [];
  const actionMap = new Map<string, WorkActionGroup>();
  let urgentCount = 0;
  let pendingCount = 0;
  let aiCount = 0;
  let consultationsTodayCount = 0;

  for (const c of input.cases) {
    if (c.status !== "active" && c.status !== "waiting") continue;

    const appt = c.patient_id ? apptByPatient.get(c.patient_id) ?? null : null;
    const next = getCaseNextDecision(c, { scheduledAt: appt?.scheduled_at ?? null });
    const processCode =
      (c.process_type_id && input.names.processCodeById[c.process_type_id]) ||
      c.journey_type ||
      null;
    const journeyType = mapJourneyType(processCode);
    const phaseCode =
      (c.phase_id && input.names.phaseCodeById[c.phase_id]) || c.phase || null;

    const { stage, slice } = phaseToBoardStage(
      journeyType,
      phaseCode,
      appt?.status ?? null,
      appt?.scheduled_at ?? null,
      next?.action ?? null,
      now
    );

    let displayName = "Contato";
    if (c.patient_id && input.names.byPatientId[c.patient_id]) {
      displayName = input.names.byPatientId[c.patient_id];
    } else if (c.lead_id && input.names.byLeadId[c.lead_id]) {
      displayName = input.names.byLeadId[c.lead_id];
    }

    const actor: DecisionActor = next?.actor ?? ownerTypeToActor(c.owner_type);
    const stageCode = stage ?? phaseCode ?? "unknown";
    const journeyCode = journeyType === "unknown" ? processCode || "unknown" : journeyType;

    const item: CaseProjectionItem = {
      caseId: c.id,
      displayName,
      patientId: c.patient_id,
      leadId: c.lead_id,
      journey: String(journeyCode).toLowerCase(),
      journeyType,
      stage: String(stageCode).toLowerCase(),
      phaseCode,
      boardStage: stage,
      panoramaSlice: slice,
      context: {
        patientId: c.patient_id,
        appointmentId: appt?.id ?? null,
        conversationId: null,
      },
      nextDecision: next,
      decider: actor,
      ownerType: c.owner_type,
      appointmentId: appt?.id ?? null,
      appointmentStatus: appt?.status ?? null,
      scheduledAt: appt?.scheduled_at ?? null,
      conversationId: null,
      href: `/dashboard/crm/jornada/${c.id}`,
    };
    items.push(item);
    bumpPanorama(panorama, stage);

    if (c.owner_type === "ai" || actor === "ai") aiCount += 1;

    if (appt?.scheduled_at) {
      const t = new Date(appt.scheduled_at).getTime();
      if (t >= dayStart && t <= dayEnd) consultationsTodayCount += 1;
    }

    if (next) {
      pendingCount += 1;
      if (next.urgent) urgentCount += 1;
      const existing = actionMap.get(next.action);
      if (existing) {
        existing.count += 1;
        existing.caseIds.push(c.id);
        if (next.urgent) existing.urgentCount += 1;
      } else {
        actionMap.set(next.action, {
          action: next.action,
          label: actionGroupLabel(next.action),
          count: 1,
          urgentCount: next.urgent ? 1 : 0,
          caseIds: [c.id],
        });
      }
    }
  }

  // Also count appointments without open cases for atendimentos hoje / falta etc.
  for (const a of input.appointments) {
    const t = new Date(a.scheduled_at).getTime();
    const linked = a.patient_id
      ? items.some((i) => i.patientId === a.patient_id && i.appointmentId === a.id)
      : false;
    if (linked) continue;
    if (a.status === "agendada" || a.status === "confirmada") {
      if (t >= dayStart && t <= dayEnd) {
        panorama.atendimentos.hoje += 1;
        consultationsTodayCount += 1;
      } else if (a.status === "agendada") {
        panorama.atendimentos.confirmar += 1;
      }
    } else if (a.status === "falta") {
      panorama.atendimentos.falta += 1;
    } else if (a.status === "realizada") {
      panorama.atendimentos.realizada += 1;
    }
  }

  const byAction = [...actionMap.values()].sort((a, b) => b.count - a.count);

  const workToday: WorkToday = {
    urgentCount,
    pendingCount,
    consultationsTodayCount,
    aiCount,
    byAction,
  };

  const pendencias = items
    .filter((i) => i.nextDecision != null)
    .sort((a, b) => {
      const au = a.nextDecision?.urgent ? 0 : 1;
      const bu = b.nextDecision?.urgent ? 0 : 1;
      if (au !== bu) return au - bu;
      return a.displayName.localeCompare(b.displayName, "pt-BR");
    });

  // Atenção = sistema priorizou (sua decisão: actor human ou urgente)
  const atencao = pendencias.filter(
    (i) => i.nextDecision?.actor === "human" || i.nextDecision?.urgent
  );

  // Caixa de entrada = aguardando outro ator / eventos ainda não "faça agora"
  const atencaoIds = new Set(atencao.map((i) => i.caseId));
  const caixaEntrada = pendencias
    .filter((i) => !atencaoIds.has(i.caseId))
    .concat(
      items.filter(
        (i) =>
          i.nextDecision == null &&
          (i.panoramaSlice === "pessoas" || i.boardStage === "contato_novo")
      )
    )
    .filter((i, idx, arr) => arr.findIndex((x) => x.caseId === i.caseId) === idx)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));

  return { workToday, panorama, items, atencao, caixaEntrada, pendencias };
}

export async function loadOperationalProjection(
  db: Db,
  clinicId: string
): Promise<OperationalProjection> {
  const now = new Date();
  const activeStart = new Date(now);
  activeStart.setDate(activeStart.getDate() - 7);
  activeStart.setHours(0, 0, 0, 0);
  const activeEnd = new Date(now);
  activeEnd.setDate(activeEnd.getDate() + 30);
  activeEnd.setHours(23, 59, 59, 999);
  const terminalStart = new Date(now);
  terminalStart.setDate(terminalStart.getDate() - 14);
  terminalStart.setHours(0, 0, 0, 0);

  const { data: caseRows } = await db
    .from("journey_cases")
    .select("*")
    .eq("clinic_id", clinicId)
    .in("status", ["active", "waiting"])
    .order("updated_at", { ascending: false })
    .limit(500);

  const cases: JourneyCase[] = (caseRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      clinic_id: String(r.clinic_id),
      contact_id: String(r.contact_id),
      lead_id: r.lead_id ? String(r.lead_id) : null,
      patient_id: r.patient_id ? String(r.patient_id) : null,
      process_type_id: r.process_type_id ? String(r.process_type_id) : null,
      workflow_version_id: r.workflow_version_id ? String(r.workflow_version_id) : null,
      phase_id: r.phase_id ? String(r.phase_id) : null,
      owner_type: (r.owner_type as JourneyCase["owner_type"]) || "system",
      owner_id: r.owner_id ? String(r.owner_id) : null,
      owner: String(r.owner ?? r.owner_type ?? "system"),
      pending_decision: (r.pending_decision as JourneyCase["pending_decision"]) ?? null,
      execution_context: (r.execution_context as JourneyCase["execution_context"]) ?? null,
      status: (r.status as JourneyCase["status"]) || "active",
      opened_at: String(r.opened_at),
      closed_at: r.closed_at ? String(r.closed_at) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      journey_type: r.journey_type ? String(r.journey_type) : null,
      phase: r.phase ? String(r.phase) : null,
    };
  });

  const [{ data: activeAppts }, { data: terminalAppts }] = await Promise.all([
    db
      .from("appointments")
      .select("id, status, scheduled_at, patient_id")
      .eq("clinic_id", clinicId)
      .in("status", ["agendada", "confirmada", "em_atendimento"])
      .gte("scheduled_at", activeStart.toISOString())
      .lte("scheduled_at", activeEnd.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(400),
    db
      .from("appointments")
      .select("id, status, scheduled_at, patient_id")
      .eq("clinic_id", clinicId)
      .in("status", ["realizada", "falta", "cancelada"])
      .gte("scheduled_at", terminalStart.toISOString())
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(400),
  ]);

  const appointments: ApptRow[] = [...(activeAppts ?? []), ...(terminalAppts ?? [])].map(
    (a) => ({
      id: String(a.id),
      status: String(a.status),
      scheduled_at: String(a.scheduled_at),
      patient_id: a.patient_id ? String(a.patient_id) : null,
    })
  );

  const patientIds = [
    ...new Set(
      [
        ...cases.map((c) => c.patient_id).filter(Boolean),
        ...appointments.map((a) => a.patient_id).filter(Boolean),
      ] as string[]
    ),
  ];
  const leadIds = [...new Set(cases.map((c) => c.lead_id).filter(Boolean) as string[])];
  const phaseIds = [...new Set(cases.map((c) => c.phase_id).filter(Boolean) as string[])];
  const processTypeIds = [
    ...new Set(cases.map((c) => c.process_type_id).filter(Boolean) as string[]),
  ];

  const [patientsRes, leadsRes, phasesRes, processRes, pipelineRes] = await Promise.all([
    patientIds.length
      ? db.from("patients").select("id, full_name").in("id", patientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    leadIds.length
      ? db.from("non_registered_pipeline").select("id, name").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    phaseIds.length
      ? db.from("workflow_phases").select("id, code").in("id", phaseIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    processTypeIds.length
      ? db.from("process_types").select("id, code").in("id", processTypeIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    // Lead lifecycle for Pessoas panorama (sem Case ainda)
    db
      .from("non_registered_pipeline")
      .select("id, lifecycle_stage, name")
      .eq("clinic_id", clinicId)
      .in("lifecycle_stage", ["lead_novo", "em_qualificacao", "qualificado", "cliente", "perdido"])
      .limit(300),
  ]);

  const byPatientId: Record<string, string> = {};
  for (const p of patientsRes.data ?? []) {
    byPatientId[String(p.id)] = String(p.full_name ?? "Paciente");
  }
  const byLeadId: Record<string, string> = {};
  for (const l of leadsRes.data ?? []) {
    byLeadId[String(l.id)] = String(l.name ?? "Contato");
  }
  const phaseCodeById: Record<string, string> = {};
  for (const p of phasesRes.data ?? []) {
    phaseCodeById[String(p.id)] = String(p.code);
  }
  const processCodeById: Record<string, string> = {};
  for (const p of processRes.data ?? []) {
    processCodeById[String(p.id)] = String(p.code);
  }

  const projection = buildOperationalProjection({
    cases,
    appointments,
    names: { byPatientId, byLeadId, phaseCodeById, processCodeById },
    now,
  });

  // Merge lead-only pessoas into panorama (leads sem case aberto)
  const caseLeadIds = new Set(cases.map((c) => c.lead_id).filter(Boolean));
  for (const lead of pipelineRes.data ?? []) {
    if (caseLeadIds.has(String(lead.id))) continue;
    const stage = String(lead.lifecycle_stage);
    if (stage === "lead_novo") projection.panorama.pessoas.novo += 1;
    else if (stage === "em_qualificacao") projection.panorama.pessoas.qualificacao += 1;
    else if (stage === "qualificado") projection.panorama.pessoas.qualificado += 1;
    else if (stage === "cliente") projection.panorama.pessoas.cliente += 1;
    else if (stage === "perdido") projection.panorama.pessoas.perdido += 1;
  }

  return projection;
}
