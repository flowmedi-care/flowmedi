"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getClinicPlanData, countMonthAppointments } from "@/lib/plan-helpers";
import { canCreateAppointment, getUpgradeMessage } from "@/lib/plan-gates";

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
  preparationNotes?: string | null
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

  if (appointmentTypeId) {
    const { data: templates } = await supabase
      .from("form_templates")
      .select("id")
      .eq("appointment_type_id", appointmentTypeId);

    if (templates?.length) {
      // Buscar email do paciente para verificar se já respondeu formulários públicos
      const { data: patient } = await supabase
        .from("patients")
        .select("email")
        .eq("id", patientId)
        .single();

      const patientEmail = patient?.email;

      // Para cada template, verificar se já existe resposta pública
      const instancesToCreate = await Promise.all(
        templates.map(async (t) => {
          let status = "pendente";
          let responses: Record<string, unknown> = {};
          let linkToken = generateLinkToken();

          // Se paciente tem email, verificar se já respondeu este formulário publicamente
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
              // Paciente já respondeu este formulário publicamente
              status = "respondido";
              responses = (publicInstance.responses as Record<string, unknown>) || {};
              // Não precisa de link_token se já está respondido
              linkToken = generateLinkToken(); // Ainda geramos para compatibilidade
            }
          }

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          return {
            appointment_id: appointment.id,
            form_template_id: t.id,
            status,
            link_token: linkToken,
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
        const { data: patient } = await supabase
          .from("patients")
          .select("email")
          .eq("id", patientId)
          .single();
        const patientEmail = patient?.email;
        const instancesToCreate = await Promise.all(
          toCreate.map(async (form_template_id: string) => {
            let status = "pendente";
            let responses: Record<string, unknown> = {};
            let linkToken = generateLinkToken();
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
            return {
              appointment_id: appointment.id,
              form_template_id,
              status,
              link_token: linkToken,
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

  // Processar evento de consulta criada
  try {
    const { processMessageEvent } = await import("@/lib/message-processor");
    
    // Processar para email
    await processMessageEvent(
      "appointment_created",
      profile.clinic_id,
      patientId,
      appointment.id,
      "email"
    );
    
    // Processar para WhatsApp
    await processMessageEvent(
      "appointment_created",
      profile.clinic_id,
      patientId,
      appointment.id,
      "whatsapp"
    );
  } catch (error) {
    // Não falhar a criação da consulta se o processamento de mensagem falhar
    console.error("Erro ao processar mensagem:", error);
  }

  revalidatePath("/dashboard/agenda");
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
    const { processMessageEvent } = await import("@/lib/message-processor");
    const supabase = await createClient();
    
    // Buscar dados da consulta
    const { data: appointment } = await supabase
      .from("appointments")
      .select("clinic_id, patient_id, scheduled_at, status")
      .eq("id", id)
      .single();

    if (appointment) {
      // Se mudou scheduled_at, é remarcação
      if (data.scheduled_at) {
        await processMessageEvent(
          "appointment_rescheduled",
          appointment.clinic_id,
          appointment.patient_id,
          id,
          "email"
        );
        await processMessageEvent(
          "appointment_rescheduled",
          appointment.clinic_id,
          appointment.patient_id,
          id,
          "whatsapp"
        );
      }

      // Se mudou status para cancelada
      if (data.status === "canceled") {
        await processMessageEvent(
          "appointment_canceled",
          appointment.clinic_id,
          appointment.patient_id,
          id,
          "email"
        );
        await processMessageEvent(
          "appointment_canceled",
          appointment.clinic_id,
          appointment.patient_id,
          id,
          "whatsapp"
        );
      }

      // Se mudou status para realizada
      if (data.status === "realizada") {
        await processMessageEvent(
          "appointment_completed",
          appointment.clinic_id,
          appointment.patient_id,
          id,
          "email"
        );
      }

      // Se mudou status para falta
      if (data.status === "falta") {
        await processMessageEvent(
          "appointment_no_show",
          appointment.clinic_id,
          appointment.patient_id,
          id,
          "email"
        );
      }
    }
  } catch (error) {
    // Não falhar a atualização se o processamento de mensagem falhar
    console.error("Erro ao processar mensagem:", error);
  }

  revalidatePath("/dashboard/agenda");
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
