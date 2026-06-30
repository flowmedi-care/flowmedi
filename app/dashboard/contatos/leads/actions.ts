"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getPipeline, syncNonRegisteredToPipeline, type PipelineItem } from "../../pipeline/actions";
import {
  getEffectiveLifecycleStage,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from "@/lib/leads/lifecycle";
import { LOSS_REASON_LABELS } from "@/lib/leads/loss-reasons";

const LEADS_PATHS = [
  "/dashboard/contatos/leads",
  "/dashboard/crm/pipeline",
  "/dashboard/contatos/todos",
];

function revalidateLeads() {
  for (const p of LEADS_PATHS) revalidatePath(p);
}

export type RepescagemItem = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  appointment_id: string | null;
  source: string;
  status: "sugerido" | "ativo" | "arquivado";
  loss_reason: string | null;
  notes: string | null;
  created_at: string;
};

export type LeadsHubMetrics = {
  byLifecycle: Record<LifecycleStage, number>;
  byLossReason: { reason: string; label: string; count: number }[];
  weeklyTrend: { week: string; captacao: number; repescagem: number }[];
  repescagemCount: number;
};

export type LeadsHubData = {
  pipeline: PipelineItem[];
  repescagem: RepescagemItem[];
  metrics: LeadsHubMetrics;
};

function buildMetrics(
  pipeline: PipelineItem[],
  repescagem: RepescagemItem[]
): LeadsHubMetrics {
  const byLifecycle = Object.fromEntries(
    LIFECYCLE_STAGES.map((s) => [s, 0])
  ) as Record<LifecycleStage, number>;

  for (const item of pipeline) {
    const stage = getEffectiveLifecycleStage(item);
    byLifecycle[stage]++;
  }

  const repescagemCount = repescagem.filter((r) => r.status !== "arquivado").length;

  const lossCounts = new Map<string, number>();
  for (const item of pipeline) {
    if (item.loss_reason) {
      lossCounts.set(item.loss_reason, (lossCounts.get(item.loss_reason) ?? 0) + 1);
    }
  }
  for (const item of repescagem) {
    if (item.loss_reason && item.status !== "arquivado") {
      lossCounts.set(item.loss_reason, (lossCounts.get(item.loss_reason) ?? 0) + 1);
    }
  }

  const byLossReason = [...lossCounts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: LOSS_REASON_LABELS[reason] ?? reason,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const weekMap = new Map<string, { captacao: number; repescagem: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    weekMap.set(key, { captacao: 0, repescagem: 0 });
  }

  for (const item of pipeline) {
    if (getEffectiveLifecycleStage(item) === "lead_novo") {
      const key = new Date(item.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      const bucket = weekMap.get(key);
      if (bucket) bucket.captacao++;
    }
  }
  for (const item of repescagem) {
    const key = new Date(item.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    const bucket = weekMap.get(key);
    if (bucket) bucket.repescagem++;
  }

  const weeklyTrend = [...weekMap.entries()].map(([week, v]) => ({
    week,
    captacao: v.captacao,
    repescagem: v.repescagem,
  }));

  return { byLifecycle, byLossReason, weeklyTrend, repescagemCount };
}

export async function getLeadsHubData(): Promise<{
  error: string | null;
  data: LeadsHubData | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  await syncNonRegisteredToPipeline();
  const pipelineRes = await getPipeline();
  if (pipelineRes.error) return { error: pipelineRes.error, data: null };

  const { data: repescagemRaw, error: repErr } = await supabase
    .from("lead_repescagem")
    .select(
      `
      id,
      patient_id,
      appointment_id,
      source,
      status,
      loss_reason,
      notes,
      created_at,
      patient:patients!patient_id ( full_name, email, phone )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (repErr) {
    // Tabela pode não existir ainda — retorna pipeline sem repescagem
    const pipeline = pipelineRes.data ?? [];
    return {
      error: null,
      data: {
        pipeline,
        repescagem: [],
        metrics: buildMetrics(pipeline, []),
      },
    };
  }

  const repescagem: RepescagemItem[] = (repescagemRaw ?? []).map((row: Record<string, unknown>) => {
    const patient = Array.isArray(row.patient) ? row.patient[0] : row.patient;
    const p = patient as { full_name?: string; email?: string; phone?: string } | null;
    return {
      id: String(row.id),
      patient_id: String(row.patient_id),
      patient_name: p?.full_name ?? "Paciente",
      patient_email: p?.email ?? null,
      patient_phone: p?.phone ?? null,
      appointment_id: row.appointment_id != null ? String(row.appointment_id) : null,
      source: String(row.source),
      status: row.status as RepescagemItem["status"],
      loss_reason: row.loss_reason != null ? String(row.loss_reason) : null,
      notes: row.notes != null ? String(row.notes) : null,
      created_at: String(row.created_at),
    };
  });

  const pipeline = pipelineRes.data ?? [];
  return {
    error: null,
    data: {
      pipeline,
      repescagem,
      metrics: buildMetrics(pipeline, repescagem),
    },
  };
}

export async function qualifyRepescagem(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("lead_repescagem")
    .update({
      status: "ativo",
      qualified_at: new Date().toISOString(),
      qualified_by: user.id,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateLeads();
  return { error: null };
}

export async function archiveRepescagem(id: string, notes?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("lead_repescagem")
    .update({
      status: "arquivado",
      archived_at: new Date().toISOString(),
      notes: notes?.trim() || undefined,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateLeads();
  return { error: null };
}

export async function setPipelineLossReason(pipelineId: string, lossReason: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("non_registered_pipeline")
    .update({ loss_reason: lossReason })
    .eq("id", pipelineId);

  if (error) return { error: error.message };
  revalidateLeads();
  return { error: null };
}

export async function createManualRepescagem(patientId: string, notes?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { error } = await supabase.from("lead_repescagem").insert({
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    source: "manual",
    status: "ativo",
    notes: notes?.trim() || null,
    qualified_at: new Date().toISOString(),
    qualified_by: user.id,
  });

  if (error) return { error: error.message };
  revalidateLeads();
  return { error: null };
}
