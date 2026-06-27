"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData } from "@/lib/plan-helpers";
import { canUseEmail, canUseWhatsApp } from "@/lib/plan-gates";
import { EVENTS_LIST_LIMIT, type EventCounts, type ClinicEventConfigItem } from "./eventos-types";

async function getEventContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, secretaryId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  const secretaryId = profile?.role === "secretaria" ? user.id : null;
  return { supabase, user, profile, secretaryId };
}

// ========== CONTAGENS REAIS (sem limite de listagem) ==========
export async function getEventCounts(): Promise<{
  data: EventCounts | null;
  error: string | null;
}> {
  const { supabase, profile, secretaryId } = await getEventContext();
  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase.rpc("get_event_counts", {
    p_clinic_id: profile.clinic_id,
    p_secretary_id: secretaryId,
  });

  if (error) {
    // Fallback: contagem aproximada via head count (sem filtro system_enabled/secretária)
    const [pendingRes, completedRes, allRes] = await Promise.all([
      supabase
        .from("event_timeline")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .eq("status", "pending"),
      supabase
        .from("event_timeline")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .in("status", ["sent", "completed_without_send", "completed"]),
      supabase
        .from("event_timeline")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id),
    ]);

    if (pendingRes.error || completedRes.error || allRes.error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        pending: pendingRes.count ?? 0,
        completed: completedRes.count ?? 0,
        all: allRes.count ?? 0,
      },
      error: null,
    };
  }

  const counts = data as { pending?: number; completed?: number; all?: number } | null;
  return {
    data: {
      pending: Number(counts?.pending ?? 0),
      completed: Number(counts?.completed ?? 0),
      all: Number(counts?.all ?? 0),
    },
    error: null,
  };
}

// ========== BUSCAR EVENTOS PENDENTES ==========
export async function getPendingEvents(filters?: {
  patientId?: string;
  eventCode?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const secretaryId = profile?.role === "secretaria" ? user.id : null;

  const { data, error } = await supabase.rpc("get_pending_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: EVENTS_LIST_LIMIT,
    p_offset: 0,
    p_secretary_id: secretaryId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
}

// ========== BUSCAR EVENTOS PASSADOS (mantido para compatibilidade) ==========
export async function getPastEvents(filters?: {
  patientId?: string;
  eventCode?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase.rpc("get_past_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: EVENTS_LIST_LIMIT,
    p_offset: 0,
  });

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
}

// ========== BUSCAR TODOS OS EVENTOS (aba Todos) ==========
export async function getAllEvents(filters?: {
  patientId?: string;
  eventCode?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const secretaryId = profile?.role === "secretaria" ? user.id : null;

  const { data, error } = await supabase.rpc("get_all_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: EVENTS_LIST_LIMIT,
    p_offset: 0,
    p_secretary_id: secretaryId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
}

// ========== BUSCAR EVENTOS CONCLUÍDOS (aba Concluídos) ==========
export async function getCompletedEvents(filters?: {
  patientId?: string;
  eventCode?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const secretaryId = profile?.role === "secretaria" ? user.id : null;

  const { data, error } = await supabase.rpc("get_completed_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: EVENTS_LIST_LIMIT,
    p_offset: 0,
    p_secretary_id: secretaryId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
}

// ========== ATUALIZAR LISTAS (refetch direto, sem cache RSC) ==========
export async function refreshEventsLists() {
  const [pending, all, completed, counts] = await Promise.all([
    getPendingEvents(),
    getAllEvents(),
    getCompletedEvents(),
    getEventCounts(),
  ]);

  return {
    pendingEvents: pending.data ?? [],
    allEvents: all.data ?? [],
    completedEvents: completed.data ?? [],
    counts: counts.data ?? { pending: 0, completed: 0, all: 0 },
    error: pending.error ?? all.error ?? completed.error ?? counts.error ?? null,
  };
}

// ========== CONCLUIR EVENTO (botão Concluir → status completed) ==========
export async function concluirEvent(eventId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { data: rpcId, error: rpcError } = await supabase.rpc("concluir_evento", {
    p_event_id: eventId,
    p_processed_by: user.id,
  });

  if (!rpcError && rpcId) {
    revalidatePath("/dashboard/eventos");
    return { error: null };
  }

  const rpcMissing =
    rpcError &&
    (rpcError.code === "PGRST202" ||
      rpcError.code === "42883" ||
      rpcError.message.includes("concluir_evento"));

  if (rpcError && !rpcMissing) {
    return { error: rpcError.message };
  }

  // Fallback: update direto (enquanto migration-concluir-evento-rpc.sql não foi aplicada)
  const processedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("event_timeline")
    .update({
      status: "completed",
      processed_at: processedAt,
      processed_by: user.id,
    })
    .eq("id", eventId)
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();

  if (updateError) return { error: updateError.message };
  if (!updated || updated.status !== "completed") {
    return { error: "Evento não encontrado ou já processado." };
  }

  revalidatePath("/dashboard/eventos");
  return { error: null };
}

// ========== CONCLUIR TODOS OS EVENTOS PENDENTES ==========
export async function concluirTodosEventos(): Promise<{
  error: string | null;
  concluded: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", concluded: 0 };

  const { data: concluded, error: rpcError } = await supabase.rpc("concluir_todos_eventos", {
    p_processed_by: user.id,
  });

  if (!rpcError && concluded != null) {
    revalidatePath("/dashboard/eventos");
    return { error: null, concluded: Number(concluded) };
  }

  const rpcMissing =
    rpcError &&
    (rpcError.code === "PGRST202" ||
      rpcError.code === "42883" ||
      rpcError.message.includes("concluir_todos_eventos"));

  if (rpcError && !rpcMissing) {
    return { error: rpcError.message, concluded: 0 };
  }

  // Fallback: concluir em lote via update direto
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", concluded: 0 };

  const { data: updated, error: updateError } = await supabase
    .from("event_timeline")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("clinic_id", profile.clinic_id)
    .eq("status", "pending")
    .select("id");

  if (updateError) return { error: updateError.message, concluded: 0 };

  revalidatePath("/dashboard/eventos");
  return { error: null, concluded: updated?.length ?? 0 };
}

// ========== PREVIEW PARA PÁGINA DE TESTE (mensagem que seria enviada) ==========
export async function getMessagePreviewForEvent(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { preview: [], eventName: undefined, patientName: undefined, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { preview: [], eventName: undefined, patientName: undefined, error: "Clínica não encontrada." };

  const { getMessagePreview } = await import("@/lib/message-processor");
  return getMessagePreview(eventId, profile.clinic_id);
}

// ========== PROCESSAR EVENTO (ENVIAR OU MARCAR COMO OK) ==========
export async function processEvent(
  eventId: string,
  action: "send" | "mark_ok",
  channelsToSend?: ("email" | "whatsapp")[]
): Promise<{ error: string | null; testMode?: boolean; eventId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  // Buscar dados do evento antes de processar
  const { data: eventData, error: fetchError } = await supabase
    .from("event_timeline")
    .select("*")
    .eq("id", eventId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (fetchError || !eventData) {
    return { error: "Evento não encontrado." };
  }

  if (eventData.status !== "pending") {
    return { error: "Evento já foi processado." };
  }

  // Evento "usuário cadastrado" não dispara contato (apenas ação recomendada)
  if (action === "send" && eventData.event_code === "patient_registered") {
    return {
      error: "Este evento não envia mensagens por email ou WhatsApp. Use a ação recomendada (Nova consulta).",
    };
  }

  // Se ação for "send", processar envio (lógica centralizada em event-send-logic-server)
  if (action === "send") {
    const planData = await getClinicPlanData();
    const emailAllowed = Boolean(
      planData && canUseEmail(planData.limits, planData.planSlug, planData.subscriptionStatus)
    );
    const whatsappAllowed = Boolean(
      planData && canUseWhatsApp(planData.planSlug, planData.subscriptionStatus)
    );

    const { executeSendForEvent } = await import("@/lib/event-send-logic-server");

    // Priorizar sempre os canais escolhidos no modal; fallback só se não vier nada (ex.: chamada sem UI)
    const channels: ("email" | "whatsapp")[] =
      channelsToSend && channelsToSend.length > 0
        ? channelsToSend
        : (eventData.event_code === "public_form_completed" && !eventData.patient_id)
          ? (["email", "whatsapp"] as const).filter((c) =>
              (eventData.channels as string[] | null)?.includes(c)
            )
          : ((eventData.channels as string[] | null) ?? []).filter(
              (c): c is "email" | "whatsapp" => c === "email" || c === "whatsapp"
            );

    if (channels.includes("email") && !emailAllowed) {
      return { error: "Envio por e-mail não está disponível no plano atual." };
    }
    if (channels.includes("whatsapp") && !whatsappAllowed) {
      return { error: "Envio por WhatsApp não está disponível no plano atual." };
    }

    if (channels.length === 0) {
      return {
        error:
          "Selecione pelo menos um canal (Email ou WhatsApp) no modal e clique em Enviar.",
      };
    }

    const result = await executeSendForEvent(
      eventId,
      {
        event_code: eventData.event_code,
        clinic_id: profile.clinic_id,
        patient_id: eventData.patient_id ?? null,
        appointment_id: eventData.appointment_id ?? null,
        form_instance_id: eventData.form_instance_id ?? null,
        sent_channels: (eventData.sent_channels as string[] | null) ?? null,
      },
      channels,
      supabase,
      true // forceImmediateSend: usuário clicou Enviar, enviar imediatamente mesmo com send_mode=manual
    );

    if (result.error) return { error: result.error };

    // Consulta agendada com link enviada manualmente: marcar form_linked do mesmo appointment como enviado (evitar duplicata)
    if (
      eventData.event_code === "appointment_created" &&
      eventData.appointment_id
    ) {
      const newSentChannels = Array.from(
        new Set([...(eventData.sent_channels as string[] | null) ?? [], ...channels])
      );
      if (newSentChannels.length > 0) {
        await supabase
          .from("event_timeline")
          .update({ sent_channels: newSentChannels })
          .eq("clinic_id", profile.clinic_id)
          .eq("appointment_id", eventData.appointment_id)
          .eq("event_code", "form_linked");
      }
    }

    revalidatePath("/dashboard/eventos");
    return { error: null };
  }

  // Se ação for "mark_ok", apenas marcar como concluído sem envio
  const { error: updateError } = await supabase
    .from("event_timeline")
    .update({
      status: "completed_without_send",
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("id", eventId);

  if (updateError) {
    return { error: `Erro ao processar evento: ${updateError.message}` };
  }

  return { error: null };
}

// ========== BUSCAR PACIENTES PARA FILTRO ==========
export async function getPatientsForFilter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", profile.clinic_id)
    .order("full_name");

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
}

// ========== PACIENTES COM PELO MENOS UMA CONSULTA (para evento "Usuário cadastrado") ==========
export async function getPatientIdsWithAppointment(): Promise<{
  data: string[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("clinic_id", profile.clinic_id)
    .not("patient_id", "is", null);

  if (error) return { data: null, error: error.message };
  const ids = [...new Set((data || []).map((r) => r.patient_id).filter(Boolean))] as string[];
  return { data: ids, error: null };
}

// ========== CONSULTAS QUE PRECISAM DE "VINCULAR FORMULÁRIO" ==========
// Mostrar ação recomendada quando: não tem NENHUM formulário vinculado
// (uma vez vinculado — pendente ou respondido — não mostra mais a ação)
export async function getAppointmentIdsNeedingFormLink(): Promise<{
  data: string[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data: appts } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", profile.clinic_id)
    .in("status", ["agendada", "confirmada"]);

  if (!appts?.length) return { data: [], error: null };

  // Consultas que têm pelo menos um form vinculado (não precisam da ação)
  const { data: linked } = await supabase
    .from("form_instances")
    .select("appointment_id")
    .in("appointment_id", appts.map((a) => a.id));

  const idsWithForm = new Set((linked || []).map((r) => r.appointment_id).filter(Boolean));
  const idsNeedingForm = appts.map((a) => a.id).filter((id) => !idsWithForm.has(id));
  return { data: idsNeedingForm, error: null };
}

// ========== BUSCAR TIPOS DE EVENTOS PARA FILTRO ==========
export async function getEventTypesForFilter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data, error } = await supabase
    .from("message_events")
    .select("code, name, category")
    .order("category, name");

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
}

// ========== CONFIG EVENTOS: clinic_event_config (sistema on/off) ==========
export async function getClinicEventConfig(): Promise<{
  data: ClinicEventConfigItem[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase
    .from("clinic_event_config")
    .select("event_code, system_enabled")
    .eq("clinic_id", profile.clinic_id);

  if (error) return { data: null, error: error.message };
  return { data: (data || []) as ClinicEventConfigItem[], error: null };
}

export async function updateClinicEventConfig(
  eventCode: string,
  systemEnabled: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin") {
    return { error: "Apenas administradores podem alterar configurações de eventos." };
  }

  const { error } = await supabase
    .from("clinic_event_config")
    .upsert(
      { clinic_id: profile.clinic_id, event_code: eventCode, system_enabled: systemEnabled, updated_at: new Date().toISOString() },
      { onConflict: "clinic_id,event_code" }
    );

  return { error: error?.message ?? null };
}
