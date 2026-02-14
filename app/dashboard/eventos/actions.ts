"use server";

import { createClient } from "@/lib/supabase/server";

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
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase.rpc("get_pending_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: 100,
    p_offset: 0,
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
    p_limit: 100,
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
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase.rpc("get_all_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: 100,
    p_offset: 0,
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
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Clínica não encontrada." };

  const { data, error } = await supabase.rpc("get_completed_events", {
    p_clinic_id: profile.clinic_id,
    p_patient_id: filters?.patientId || null,
    p_event_code: filters?.eventCode || null,
    p_limit: 100,
    p_offset: 0,
  });

  if (error) return { data: null, error: error.message };
  return { data: data || [], error: null };
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

  const { error: updateError } = await supabase
    .from("event_timeline")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("id", eventId)
    .eq("clinic_id", profile.clinic_id);

  if (updateError) return { error: updateError.message };
  return { error: null };
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
  action: "send" | "mark_ok"
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
    return { error: null, testMode: false };
  }

  // Se ação for "send", processar envio ou modo teste (preview)
  if (action === "send") {
    const { processMessageEvent, processEventByIdForPublicForm, MESSAGE_TEST_MODE } = await import("@/lib/message-processor");

    if (MESSAGE_TEST_MODE) {
      // Modo teste: não envia; retorna eventId para redirecionar à página de preview
      return { error: null, testMode: true, eventId };
    }

    try {
      if (!eventData.patient_id && eventData.event_code === "public_form_completed") {
        const result = await processEventByIdForPublicForm(eventId);
        if (!result.success) {
          return { error: result.error ?? "Erro ao enviar." };
        }
      } else {
        const channels = eventData.channels || [];
        for (const channel of channels) {
          if (eventData.patient_id) {
            await processMessageEvent(
              eventData.event_code,
              profile.clinic_id,
              eventData.patient_id,
              eventData.appointment_id || null,
              channel as "email" | "whatsapp"
            );
          }
        }
      }

      const { error: updateError } = await supabase
        .from("event_timeline")
        .update({
          status: "sent",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
        })
        .eq("id", eventId);

      if (updateError) {
        return { error: `Erro ao atualizar evento: ${updateError.message}` };
      }

      return { error: null };
    } catch (error: any) {
      return { error: `Erro ao enviar mensagens: ${error.message}` };
    }
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
export type ClinicEventConfigItem = { event_code: string; system_enabled: boolean };

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
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const { error } = await supabase
    .from("clinic_event_config")
    .upsert(
      { clinic_id: profile.clinic_id, event_code: eventCode, system_enabled: systemEnabled, updated_at: new Date().toISOString() },
      { onConflict: "clinic_id,event_code" }
    );

  return { error: error?.message ?? null };
}
