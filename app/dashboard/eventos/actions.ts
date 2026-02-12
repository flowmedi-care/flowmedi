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

// ========== BUSCAR EVENTOS PASSADOS ==========
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

// ========== PROCESSAR EVENTO (ENVIAR OU MARCAR COMO OK) ==========
export async function processEvent(
  eventId: string,
  action: "send" | "mark_ok"
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

  // Se ação for "send", precisamos processar via processMessageEvent
  if (action === "send") {
    try {
      const { processMessageEvent } = await import("@/lib/message-processor");
      
      // Processar para cada canal configurado
      const channels = eventData.channels || [];
      let sentCount = 0;
      
      for (const channel of channels) {
        if (eventData.appointment_id && eventData.patient_id) {
          await processMessageEvent(
            eventData.event_code,
            profile.clinic_id,
            eventData.patient_id,
            eventData.appointment_id,
            channel as "email" | "whatsapp"
          );
          sentCount++;
        }
      }

      // Atualizar status do evento para "sent"
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
