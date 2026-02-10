"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PipelineStage = 
  | "novo_contato" 
  | "aguardando_retorno" 
  | "agendado" 
  | "registrado" 
  | "arquivado";

export type PipelineItem = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  custom_fields: Record<string, unknown>;
  stage: PipelineStage;
  last_contact_at: string | null;
  next_action: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  forms: Array<{
    id: string;
    template_name: string;
    status: string;
    created_at: string;
  }>;
  history: Array<{
    id: string;
    action_type: string;
    old_stage: string | null;
    new_stage: string | null;
    notes: string | null;
    action_by: {
      id: string;
      full_name: string | null;
    };
    created_at: string;
  }>;
};

// Sincronizar não cadastrados do form_instances para o pipeline
export async function syncNonRegisteredToPipeline() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  // Buscar não cadastrados do form_instances
  const nonRegisteredRes = await getNonRegisteredSubmitters();
  if (nonRegisteredRes.error || !nonRegisteredRes.data) {
    return { error: nonRegisteredRes.error || "Erro ao buscar não cadastrados." };
  }

  // Para cada não cadastrado, garantir que existe no pipeline
  for (const item of nonRegisteredRes.data) {
    const emailLower = item.email.toLowerCase().trim();
    
    // Verificar se já existe no pipeline
    const { data: existing } = await supabase
      .from("non_registered_pipeline")
      .select("id")
      .eq("clinic_id", profile.clinic_id)
      .eq("email", emailLower)
      .maybeSingle();

    if (!existing) {
      // Criar entrada no pipeline
      const { error: insertError } = await supabase
        .from("non_registered_pipeline")
        .insert({
          clinic_id: profile.clinic_id,
          email: emailLower,
          name: item.name,
          phone: item.phone,
          birth_date: item.birth_date || null,
          custom_fields: item.custom_fields || {},
          stage: "novo_contato",
        });

      if (insertError) {
        console.error("Erro ao criar pipeline entry:", insertError);
      }
    } else {
      // Atualizar dados se necessário (nome, telefone, etc podem ter mudado)
      const { error: updateError } = await supabase
        .from("non_registered_pipeline")
        .update({
          name: item.name || undefined,
          phone: item.phone || undefined,
          birth_date: item.birth_date || undefined,
          custom_fields: item.custom_fields || {},
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Erro ao atualizar pipeline entry:", updateError);
      }
    }
  }

  revalidatePath("/dashboard");
  return { error: null };
}

// Buscar não cadastrados (função auxiliar para sincronização)
async function getNonRegisteredSubmitters() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const { data: registeredPatients } = await supabase
    .from("patients")
    .select("email")
    .eq("clinic_id", profile.clinic_id)
    .not("email", "is", null);

  const registeredEmails = new Set<string>();
  (registeredPatients ?? []).forEach((p) => {
    if (p.email) {
      const normalized = p.email.toLowerCase().trim();
      if (normalized) {
        registeredEmails.add(normalized);
      }
    }
  });

  const { data, error } = await supabase
    .from("form_instances")
    .select(`
      id,
      public_submitter_name,
      public_submitter_email,
      public_submitter_phone,
      public_submitter_birth_date,
      public_submitter_custom_fields,
      status,
      created_at,
      form_template_id,
      form_templates!inner (
        name,
        clinic_id
      )
    `)
    .is("appointment_id", null)
    .not("public_submitter_email", "is", null)
    .eq("form_templates.clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: null };

  const grouped = new Map<
    string,
    {
      email: string;
      name: string | null;
      phone: string | null;
      birth_date: string | null;
      custom_fields: Record<string, unknown>;
      forms: Array<{
        id: string;
        template_name: string;
        status: string;
        created_at: string;
      }>;
      latest_form_date: string;
    }
  >();

  (data ?? []).forEach((item: Record<string, unknown>) => {
    const email = String(item.public_submitter_email || "");
    if (!email) return;

    const emailLower = email.toLowerCase().trim();
    if (registeredEmails.has(emailLower)) {
      return;
    }

    const template = Array.isArray(item.form_templates)
      ? item.form_templates[0]
      : item.form_templates;
    const templateName = (template as { name?: string } | null)?.name || "Formulário";

    if (!grouped.has(email)) {
      grouped.set(email, {
        email,
        name: (item.public_submitter_name as string) || null,
        phone: (item.public_submitter_phone as string) || null,
        birth_date: (item.public_submitter_birth_date as string) || null,
        custom_fields: {},
        forms: [],
        latest_form_date: String(item.created_at || ""),
      });
    }

    const entry = grouped.get(email)!;
    entry.forms.push({
      id: String(item.id),
      template_name: templateName,
      status: String(item.status || "pendente"),
      created_at: String(item.created_at || ""),
    });

    if (item.public_submitter_custom_fields) {
      const customFields = item.public_submitter_custom_fields as Record<string, unknown>;
      Object.assign(entry.custom_fields, customFields);
    }

    if (String(item.created_at || "") > entry.latest_form_date) {
      entry.latest_form_date = String(item.created_at || "");
    }
  });

  return {
    error: null,
    data: Array.from(grouped.values()),
  };
}

// Buscar pipeline completo com histórico
export async function getPipeline() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  // Buscar pipeline
  const { data: pipelineItems, error: pipelineError } = await supabase
    .from("non_registered_pipeline")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .order("updated_at", { ascending: false });

  if (pipelineError) return { error: pipelineError.message, data: null };

  // Buscar formulários para cada item
  const { data: formInstances } = await supabase
    .from("form_instances")
    .select(`
      id,
      public_submitter_email,
      status,
      created_at,
      form_template_id,
      form_templates!inner (
        name,
        clinic_id
      )
    `)
    .is("appointment_id", null)
    .not("public_submitter_email", "is", null)
    .eq("form_templates.clinic_id", profile.clinic_id);

  // Buscar histórico para cada item
  const pipelineIds = (pipelineItems || []).map((p) => p.id);
  const { data: historyItems } = pipelineIds.length > 0
    ? await supabase
        .from("non_registered_history")
        .select(`
          id,
          pipeline_id,
          action_type,
          old_stage,
          new_stage,
          notes,
          created_at,
          action_by,
          profiles!non_registered_history_action_by_fkey (
            id,
            full_name
          )
        `)
        .in("pipeline_id", pipelineIds)
        .order("created_at", { ascending: false })
    : { data: null };

  // Combinar dados
  const items: PipelineItem[] = (pipelineItems || []).map((item) => {
    const emailLower = item.email.toLowerCase().trim();
    
    // Buscar formulários deste email
    const forms = (formInstances || [])
      .filter((fi: any) => {
        const fiEmail = String(fi.public_submitter_email || "").toLowerCase().trim();
        return fiEmail === emailLower;
      })
      .map((fi: any) => {
        const template = Array.isArray(fi.form_templates)
          ? fi.form_templates[0]
          : fi.form_templates;
        return {
          id: String(fi.id),
          template_name: (template as { name?: string } | null)?.name || "Formulário",
          status: String(fi.status || "pendente"),
          created_at: String(fi.created_at || ""),
        };
      });

    // Buscar histórico deste item
    const history = (historyItems || [])
      .filter((h: any) => h.pipeline_id === item.id)
      .map((h: any) => {
        const profile = Array.isArray(h.profiles)
          ? h.profiles[0]
          : h.profiles;
        return {
          id: String(h.id),
          action_type: String(h.action_type || ""),
          old_stage: h.old_stage,
          new_stage: h.new_stage,
          notes: h.notes,
          action_by: {
            id: String(h.action_by || ""),
            full_name: (profile as { full_name?: string } | null)?.full_name || null,
          },
          created_at: String(h.created_at || ""),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      id: item.id,
      email: item.email,
      name: item.name,
      phone: item.phone,
      birth_date: item.birth_date,
      custom_fields: (item.custom_fields as Record<string, unknown>) || {},
      stage: item.stage as PipelineStage,
      last_contact_at: item.last_contact_at,
      next_action: item.next_action,
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at,
      forms,
      history,
    };
  });

  return { error: null, data: items };
}

// Mudar etapa do pipeline
export async function changePipelineStage(
  pipelineId: string,
  newStage: PipelineStage,
  notes?: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Buscar item atual
  const { data: currentItem } = await supabase
    .from("non_registered_pipeline")
    .select("stage, clinic_id")
    .eq("id", pipelineId)
    .single();

  if (!currentItem) return { error: "Item não encontrado." };

  const oldStage = currentItem.stage;

  // Atualizar etapa
  const updateData: Record<string, unknown> = {
    stage: newStage,
  };

  if (newStage === "aguardando_retorno" || newStage === "agendado") {
    updateData.last_contact_at = new Date().toISOString();
  }

  if (notes) {
    updateData.notes = notes;
  }

  const { error: updateError } = await supabase
    .from("non_registered_pipeline")
    .update(updateData)
    .eq("id", pipelineId);

  if (updateError) return { error: updateError.message };

  // Registrar histórico
  const { error: historyError } = await supabase
    .from("non_registered_history")
    .insert({
      pipeline_id: pipelineId,
      action_by: user.id,
      action_type: "stage_change",
      old_stage: oldStage,
      new_stage: newStage,
      notes: notes || null,
    });

  if (historyError) {
    console.error("Erro ao registrar histórico:", historyError);
  }

  revalidatePath("/dashboard");
  return { error: null };
}

// Adicionar nota ao pipeline
export async function addPipelineNote(
  pipelineId: string,
  note: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Buscar nota atual
  const { data: currentItem } = await supabase
    .from("non_registered_pipeline")
    .select("notes")
    .eq("id", pipelineId)
    .single();

  if (!currentItem) return { error: "Item não encontrado." };

  const currentNotes = currentItem.notes || "";
  const newNotes = currentNotes
    ? `${currentNotes}\n\n[${new Date().toLocaleString("pt-BR")}] ${note}`
    : `[${new Date().toLocaleString("pt-BR")}] ${note}`;

  const { error: updateError } = await supabase
    .from("non_registered_pipeline")
    .update({ notes: newNotes })
    .eq("id", pipelineId);

  if (updateError) return { error: updateError.message };

  // Registrar histórico
  const { error: historyError } = await supabase
    .from("non_registered_history")
    .insert({
      pipeline_id: pipelineId,
      action_by: user.id,
      action_type: "note_added",
      notes: note,
    });

  if (historyError) {
    console.error("Erro ao registrar histórico:", historyError);
  }

  revalidatePath("/dashboard");
  return { error: null };
}

// Atualizar próxima ação
export async function updateNextAction(
  pipelineId: string,
  nextAction: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error: updateError } = await supabase
    .from("non_registered_pipeline")
    .update({ next_action: nextAction })
    .eq("id", pipelineId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard");
  return { error: null };
}
