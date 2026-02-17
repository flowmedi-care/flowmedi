"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData, countMonthAppointments } from "@/lib/plan-helpers";
import { canCreateAppointment, getUpgradeMessage } from "@/lib/plan-gates";

/** Formulários públicos preenchidos pelo paciente que serão vinculados automaticamente à consulta */
export async function getPublicFormTemplatesForPatient(patientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { data: [], error: "Clínica não encontrada." };

  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();
  if (!patient?.email) return { data: [], error: null };

  const { data, error } = await supabase
    .from("form_instances")
    .select(`
      form_template_id,
      form_templates!inner ( id, name, clinic_id )
    `)
    .is("appointment_id", null)
    .ilike("public_submitter_email", patient.email.trim())
    .eq("status", "respondido")
    .eq("form_templates.clinic_id", profile.clinic_id);

  if (error) return { data: [], error: error.message };

  const templates = (data ?? []).map((r: { form_templates: { id: string; name: string } | { id: string; name: string }[] }) => {
    const t = Array.isArray(r.form_templates) ? r.form_templates[0] : r.form_templates;
    return { id: t?.id ?? "", name: t?.name ?? "" };
  });
  const unique = Array.from(new Map(templates.map((t) => [t.id, t])).values()).filter((t) => t.id);
  return { data: unique, error: null };
}

import { slugify } from "@/lib/form-slug";

function generateLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
}

export async function createAppointment(
  patientId: string,
  doctorId: string,
  appointmentTypeId: string | null,
  scheduledAt: string,
  notes?: string | null,
  recommendations?: string | null,
  procedureId?: string | null,
  requiresFasting?: boolean,
  requiresMedicationStop?: boolean,
  specialInstructions?: string | null,
  preparationNotes?: string | null,
  linkedFormTemplateIds?: string[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  // Verificar limite de consultas/mês
  const planData = await getClinicPlanData();
  if (planData) {
    const currentMonthCount = await countMonthAppointments(profile.clinic_id);
    const check = canCreateAppointment(planData.limits, currentMonthCount);
    
    if (!check.allowed) {
      const upgradeMsg = getUpgradeMessage("consultas/mês");
      return { error: `${check.reason}. ${upgradeMsg}` };
    }
  }

  const { data: appointment, error: insertErr } = await supabase
    .from("appointments")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_type_id: appointmentTypeId || null,
      procedure_id: procedureId || null,
      scheduled_at: scheduledAt,
      status: "agendada",
      notes: notes || null,
      recommendations: recommendations || null,
      requires_fasting: requiresFasting || false,
      requires_medication_stop: requiresMedicationStop || false,
      special_instructions: specialInstructions || null,
      preparation_notes: preparationNotes || null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!appointment) return { error: "Erro ao criar consulta." };

  const formLinkedEventIds: string[] = [];

  // Dados para slug amigável (clínica + formulário + paciente)
  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name")
    .eq("id", profile.clinic_id)
    .single();
  let clinicSlug = clinic?.slug || slugify(clinic?.name || "clinica");
  if (!clinic?.slug) {
    await supabase.from("clinics").update({ slug: clinicSlug }).eq("id", profile.clinic_id);
  }
  const { data: patientForSlug } = await supabase
    .from("patients")
    .select("full_name, email")
    .eq("id", patientId)
    .single();
  const patientSlug = slugify(patientForSlug?.full_name || "paciente");

  async function ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    for (let i = 0; i <= 10; i++) {
      const candidate = i === 0 ? slug : `${baseSlug}-${i}`;
      const { data: existing } = await supabase
        .from("form_instances")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!existing) return candidate;
    }
    return `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
  }

  if (appointmentTypeId) {
    const { data: templates } = await supabase
      .from("form_templates")
      .select("id, name")
      .eq("appointment_type_id", appointmentTypeId);

    if (templates?.length) {
      const patientEmail = patientForSlug?.email;

      const instancesToCreate = await Promise.all(
        templates.map(async (t) => {
          let status = "pendente";
          let responses: Record<string, unknown> = {};
          let linkToken = generateLinkToken();

          if (patientEmail) {
            const { data: publicInstance } = await supabase
              .from("form_instances")
              .select("responses, status")
              .eq("form_template_id", t.id)
              .is("appointment_id", null)
              .eq("public_submitter_email", patientEmail)
              .eq("status", "respondido")
              .maybeSingle();

            if (publicInstance && publicInstance.responses) {
              status = "respondido";
              responses = (publicInstance.responses as Record<string, unknown>) || {};
              linkToken = generateLinkToken();
            }
          }

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          const formSlug = slugify((t as { name?: string }).name || "formulario");
          const combinedSlug = await ensureUniqueSlug(`${clinicSlug}/${formSlug}/${patientSlug}`);

          return {
            appointment_id: appointment.id,
            form_template_id: t.id,
            status,
            link_token: linkToken,
            slug: combinedSlug,
            link_expires_at: expiresAt.toISOString(),
            responses,
          };
        })
      );

      await supabase.from("form_instances").insert(instancesToCreate);
    }
  }

  // Formulários vinculados ao procedimento (evitar duplicar se já veio do tipo)
  if (procedureId) {
    const { data: procLinks, error: procLinksError } = await supabase
      .from("form_template_procedures")
      .select("form_template_id")
      .eq("procedure_id", procedureId);
    if (procLinksError) {
      console.error("[createAppointment] form_template_procedures select:", procLinksError);
    }
    const procedureTemplateIds = (procLinks ?? [])
      .map((r: { form_template_id?: string }) => r.form_template_id)
      .filter((id): id is string => !!id);
    if (procedureTemplateIds.length > 0) {
      const { data: existingInstances } = await supabase
        .from("form_instances")
        .select("form_template_id")
        .eq("appointment_id", appointment.id);
      const existingIds = new Set(
        (existingInstances ?? []).map((r: { form_template_id: string }) => r.form_template_id)
      );
      const toCreate = procedureTemplateIds.filter((id) => !existingIds.has(id));
      if (toCreate.length > 0) {
        const patientEmail = patientForSlug?.email;
        const { data: procTemplates } = await supabase
          .from("form_templates")
          .select("id, name")
          .in("id", toCreate);
        const nameById = new Map((procTemplates ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
        const instancesToCreate = await Promise.all(
          toCreate.map(async (form_template_id: string) => {
            let status = "pendente";
            let responses: Record<string, unknown> = {};
            const linkToken = generateLinkToken();
            if (patientEmail) {
              const { data: publicInstance } = await supabase
                .from("form_instances")
                .select("responses, status")
                .eq("form_template_id", form_template_id)
                .is("appointment_id", null)
                .eq("public_submitter_email", patientEmail)
                .eq("status", "respondido")
                .maybeSingle();
              if (publicInstance?.responses) {
                status = "respondido";
                responses = (publicInstance.responses as Record<string, unknown>) || {};
              }
            }
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            const formSlug = slugify(nameById.get(form_template_id) || "formulario");
            const combinedSlug = await ensureUniqueSlug(`${clinicSlug}/${formSlug}/${patientSlug}`);
            return {
              appointment_id: appointment.id,
              form_template_id,
              status,
              link_token: linkToken,
              slug: combinedSlug,
              link_expires_at: expiresAt.toISOString(),
              responses,
            };
          })
        );
        const { error: insertProcErr } = await supabase
          .from("form_instances")
          .insert(instancesToCreate);
        if (insertProcErr) {
          console.error("[createAppointment] form_instances insert (procedure):", insertProcErr);
        }
      }
    }
  }

  // Formulários explicitamente vinculados (opção "Vincular formulário" na nova consulta)
  if (linkedFormTemplateIds?.length) {
    const { data: existingInstances } = await supabase
      .from("form_instances")
      .select("form_template_id")
      .eq("appointment_id", appointment.id);
    const existingIds = new Set(
      (existingInstances ?? []).map((r: { form_template_id: string }) => r.form_template_id)
    );
    const toCreate = linkedFormTemplateIds.filter((id) => id && !existingIds.has(id));
    if (toCreate.length > 0) {
      const patientEmail = patientForSlug?.email;
      const { data: linkedTemplates } = await supabase
        .from("form_templates")
        .select("id, name")
        .in("id", toCreate);
      const nameById = new Map((linkedTemplates ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
      const instancesToCreate = await Promise.all(
        toCreate.map(async (form_template_id: string) => {
          let status = "pendente";
          let responses: Record<string, unknown> = {};
          const linkToken = generateLinkToken();
          if (patientEmail) {
            const { data: publicInstance } = await supabase
              .from("form_instances")
              .select("responses, status")
              .eq("form_template_id", form_template_id)
              .is("appointment_id", null)
              .eq("public_submitter_email", patientEmail)
              .eq("status", "respondido")
              .maybeSingle();
            if (publicInstance?.responses) {
              status = "respondido";
              responses = (publicInstance.responses as Record<string, unknown>) || {};
            }
          }
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          const formSlug = slugify(nameById.get(form_template_id) || "formulario");
          const combinedSlug = await ensureUniqueSlug(`${clinicSlug}/${formSlug}/${patientSlug}`);
          return {
            appointment_id: appointment.id,
            form_template_id,
            status,
            link_token: linkToken,
            slug: combinedSlug,
            link_expires_at: expiresAt.toISOString(),
            responses,
          };
        })
      );
      const { data: insertedRows } = await supabase
        .from("form_instances")
        .insert(instancesToCreate)
        .select("id");
      // Criar evento form_linked para cada formulário vinculado (envio será marcado após appointment_created)
      if (insertedRows?.length) {
        for (const row of insertedRows) {
          try {
            const { data: evId } = await supabase.rpc("create_event_timeline", {
              p_clinic_id: profile.clinic_id,
              p_event_code: "form_linked",
              p_patient_id: patientId,
              p_appointment_id: appointment.id,
              p_form_instance_id: row.id,
              p_origin: "user",
            });
            if (evId) formLinkedEventIds.push(evId);
          } catch (e) {
            console.error("[createAppointment] form_linked event:", e);
          }
        }
      }
    }
  }

  // Vincular formulários públicos já preenchidos pelo paciente (por email) — atualiza as instâncias existentes
  const { data: patientForLink } = await supabase
    .from("patients")
    .select("email")
    .eq("id", patientId)
    .single();
  if (patientForLink?.email) {
    const { data: publicInstances } = await supabase
      .from("form_instances")
      .select("id, form_templates!inner(clinic_id)")
      .is("appointment_id", null)
      .eq("status", "respondido")
      .ilike("public_submitter_email", patientForLink.email.trim())
      .eq("form_templates.clinic_id", profile.clinic_id);
    const ids = (publicInstances ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await supabase
        .from("form_instances")
        .update({ appointment_id: appointment.id })
        .in("id", ids);
      // Criar evento form_linked para cada formulário público vinculado (envio será marcado após appointment_created)
      try {
        for (const formInstanceId of ids) {
          const { data: evId } = await supabase.rpc("create_event_timeline", {
            p_clinic_id: profile.clinic_id,
            p_event_code: "form_linked",
            p_patient_id: patientId,
            p_appointment_id: appointment.id,
            p_form_instance_id: formInstanceId,
            p_origin: "user",
          });
          if (evId) formLinkedEventIds.push(evId);
        }
      } catch (e) {
        console.error("[createAppointment] form_linked event (public):", e);
      }
    }
  }

  // Verificar se paciente estava no pipeline e remover
  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", patientId)
    .single();

  if (patient?.email) {
    const { data: pipelineItem } = await supabase
      .from("non_registered_pipeline")
      .select("id, stage")
      .eq("email", patient.email.toLowerCase().trim())
      .maybeSingle();

    if (pipelineItem) {
      // Se estiver em "cadastrado", mover para "agendado"
      if (pipelineItem.stage === "cadastrado") {
        await supabase
          .from("non_registered_pipeline")
          .update({ stage: "agendado" })
          .eq("id", pipelineItem.id);

        // Registrar histórico
        await supabase
          .from("non_registered_history")
          .insert({
            pipeline_id: pipelineItem.id,
            action_by: user.id,
            action_type: "stage_change",
            old_stage: "cadastrado",
            new_stage: "agendado",
            notes: "Consulta agendada",
          });
      }
    }
  }

  // Processar evento de consulta agendada (template com/sem link conforme form respondido)
  // O trigger cria o evento em event_timeline; enviamos via runAutoSendForEvent
  let appointmentCreatedSentChannels: string[] = [];
  try {
    const { data: eventRow } = await supabase
      .from("event_timeline")
      .select("id")
      .eq("clinic_id", profile.clinic_id)
      .eq("appointment_id", appointment.id)
      .eq("event_code", "appointment_created")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eventRow) {
      const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
      await runAutoSendForEvent(eventRow.id, profile.clinic_id, "appointment_created", supabase);
      // Se criamos form_linked junto ao agendamento, marcar como enviado sem enviar (evitar duplicata)
      if (formLinkedEventIds.length > 0) {
        const { data: sentRow } = await supabase
          .from("event_timeline")
          .select("sent_channels")
          .eq("id", eventRow.id)
          .single();
        appointmentCreatedSentChannels = (sentRow?.sent_channels as string[]) ?? [];
      }
    }
  } catch (error) {
    // Não falhar a criação da consulta se o processamento de mensagem falhar
    console.error("Erro ao processar mensagem:", error);
  }

  if (formLinkedEventIds.length > 0 && appointmentCreatedSentChannels.length > 0) {
    await supabase
      .from("event_timeline")
      .update({ sent_channels: appointmentCreatedSentChannels })
      .in("id", formLinkedEventIds);
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/eventos");
  revalidatePath("/dashboard");
  return { data: { id: appointment.id }, error: null };
}

export async function updateAppointment(
  id: string,
  data: {
    patient_id?: string;
    doctor_id?: string;
    appointment_type_id?: string | null;
    procedure_id?: string | null;
    scheduled_at?: string;
    status?: string;
    notes?: string | null;
    recommendations?: string | null;
    requires_fasting?: boolean;
    requires_medication_stop?: boolean;
    special_instructions?: string | null;
    preparation_notes?: string | null;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Processar eventos relacionados a mudanças na consulta
  try {
    const supabase = await createClient();
    const { data: appointment } = await supabase
      .from("appointments")
      .select("clinic_id, patient_id, scheduled_at, status")
      .eq("id", id)
      .single();

    if (appointment) {
      const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");

      // Remarcação: trigger cria appointment_rescheduled; processamos via event_timeline
      if (data.scheduled_at) {
        const { data: ev } = await supabase
          .from("event_timeline")
          .select("id")
          .eq("clinic_id", appointment.clinic_id)
          .eq("appointment_id", id)
          .eq("event_code", "appointment_rescheduled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ev) await runAutoSendForEvent(ev.id, appointment.clinic_id, "appointment_rescheduled", supabase);
      }

      // Cancelada, confirmada, realizada, falta: trigger cria evento; processamos via event_timeline
      const eventByStatus: Record<string, string> = {
        canceled: "appointment_canceled",
        confirmada: "appointment_confirmed",
        realizada: "appointment_completed",
        falta: "appointment_no_show",
      };
      const eventCode = data.status ? eventByStatus[data.status] : null;
      if (eventCode) {
        const { data: ev } = await supabase
          .from("event_timeline")
          .select("id")
          .eq("clinic_id", appointment.clinic_id)
          .eq("appointment_id", id)
          .eq("event_code", eventCode)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ev) await runAutoSendForEvent(ev.id, appointment.clinic_id, eventCode, supabase);
      }
    }
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/eventos");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/agenda/consulta/${id}`);
  return { error: null };
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  return { error: null };
}

export async function updateUserPreferences(preferences: {
  agenda_view_mode?: "timeline" | "calendar";
  agenda_timeline_granularity?: "day" | "week" | "month";
  agenda_calendar_granularity?: "week" | "month";
  agenda_status_filter?: string[];
  agenda_form_filter?: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Buscar preferências atuais
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
  const newPrefs = { ...currentPrefs, ...preferences };

  const { error } = await supabase
    .from("profiles")
    .update({
      preferences: newPrefs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  return { error: null };
}
