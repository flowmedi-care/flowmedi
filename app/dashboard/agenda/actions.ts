"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";
import {
  syncAppointmentProcedures,
  buildConsumptionFromProcedures,
  commitStockForAppointment,
  releaseStockForAppointment,
} from "@/lib/clinic-operations";
import { loadAppointmentProcedures, loadServiceName } from "@/lib/appointment-procedures";

/** Vincula conversa(s) WhatsApp do paciente à secretária que agendou (para ela ver no pool). */
async function linkWhatsAppConversationToSecretary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string,
  secretaryId: string
) {
  try {
    const { data: patient } = await supabase
      .from("patients")
      .select("phone")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();
    if (!patient?.phone) return;

    const digits = (patient.phone as string).replace(/\D/g, "");
    if (digits.length < 10) return;

    const normalized = normalizeWhatsAppPhone(digits.startsWith("55") ? digits : `55${digits}`);
    const phoneVariants = [normalized, `55${digits}`, digits].filter((v, i, a) => v && a.indexOf(v) === i);

    const service = createServiceRoleClient();
    const { data: convs } = await service
      .from("whatsapp_conversations")
      .select("id, patient_id")
      .eq("clinic_id", clinicId)
      .in("phone_number", phoneVariants);

    for (const conv of convs ?? []) {
      const updates: Record<string, unknown> = {};
      if (!conv.patient_id) updates.patient_id = patientId;
      if (Object.keys(updates).length > 0) {
        await service
          .from("whatsapp_conversations")
          .update(updates)
          .eq("id", conv.id);
      }
      await service
        .from("conversation_eligible_secretaries")
        .upsert(
          { conversation_id: conv.id, secretary_id: secretaryId },
          { onConflict: "conversation_id,secretary_id" }
        );
    }
  } catch {
    // Não falhar o agendamento se o vínculo falhar
  }
}

function generateLinkToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + Date.now().toString(36);
}

/** Resolve o valor da consulta a partir do serviço, médico e dimensões selecionadas (regra mais específica). */
export async function resolveAppointmentPrice(
  serviceId: string,
  professionalId: string,
  dimensionValueIds: string[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { valor: null, error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { valor: null, error: "Clínica não encontrada." };

  const { data: rules } = await supabase
    .from("service_prices")
    .select("id, valor, professional_id")
    .eq("clinic_id", profile.clinic_id)
    .eq("service_id", serviceId)
    .eq("ativo", true)
    .or(`professional_id.is.null,professional_id.eq.${professionalId}`);

  if (!rules?.length) return { valor: null, error: null };

  const ruleIds = rules.map((r) => r.id);
  const { data: prdv } = await supabase
    .from("price_rule_dimension_values")
    .select("service_price_id, dimension_value_id")
    .in("service_price_id", ruleIds);

  const ruleDimensionSets: Record<string, Set<string>> = {};
  for (const r of rules) ruleDimensionSets[r.id] = new Set();
  for (const row of prdv ?? []) {
    if (ruleDimensionSets[row.service_price_id]) ruleDimensionSets[row.service_price_id].add(row.dimension_value_id);
  }

  const selectedSet = new Set(dimensionValueIds);
  let best: { id: string; valor: number; size: number; isProfessionalSpecific: boolean } | null = null;
  for (const r of rules) {
    const ruleSet = ruleDimensionSets[r.id];
    if (!ruleSet) continue;
    const isSubset = [...ruleSet].every((id) => selectedSet.has(id));
    if (!isSubset) continue;
    const isProfessionalSpecific = r.professional_id != null && r.professional_id === professionalId;
    const candidate = { id: r.id, valor: Number(r.valor), size: ruleSet.size, isProfessionalSpecific };
    if (!best) {
      best = candidate;
      continue;
    }
    if (ruleSet.size > best.size) best = candidate;
    else if (ruleSet.size === best.size && isProfessionalSpecific && !best.isProfessionalSpecific) best = candidate;
  }
  if (!best) return { valor: null, error: null };
  return { valor: best.valor, error: null };
}

export type AppointmentChargePreview = {
  serviceAmount: number;
  materialsAmount: number;
  totalAmount: number;
  materialLines: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  linkedServiceId: string | null;
  linkedServiceName: string | null;
  warnings: string[];
};

/** Preview unificado: procedimento(s) → serviço + insumos → total. */
export async function getAppointmentChargePreview(
  procedureIds: string[],
  doctorId: string,
  serviceId: string | null,
  dimensionValueIds: string[]
): Promise<{ error: string | null; data: AppointmentChargePreview | null }> {
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

  const warnings: string[] = [];
  const { getBomEstimateForProcedures, resolveMultiProcedurePrice } = await import(
    "@/lib/clinic-operations"
  );
  const { computeChargeTotal } = await import("@/lib/appointment-charge");

  const materialLines = await getBomEstimateForProcedures(supabase, procedureIds);
  const materialsAmount = materialLines.reduce((s, l) => s + l.line_total, 0);

  if (procedureIds.length && materialLines.length === 0) {
    warnings.push("Procedimento(s) sem insumos cadastrados no BOM.");
  }

  let serviceAmount = 0;
  let linkedServiceId = serviceId || null;

  if (serviceId) {
    const res = await resolveAppointmentPrice(serviceId, doctorId, dimensionValueIds);
    serviceAmount = res.valor ?? 0;
    if (res.valor == null) {
      warnings.push("Nenhuma regra de preço encontrada para o serviço selecionado.");
    }
  } else if (procedureIds.length) {
    const multi = await resolveMultiProcedurePrice(
      supabase,
      profile.clinic_id,
      procedureIds,
      doctorId,
      dimensionValueIds,
      async (sid, profId, dimIds) => resolveAppointmentPrice(sid, profId, dimIds)
    );
    serviceAmount = multi ?? 0;
    if (multi == null) {
      warnings.push("Configure o serviço padrão no procedimento e as regras em Serviços e Valores.");
    }
    const { data: procs } = await supabase
      .from("procedures")
      .select("default_service_id")
      .in("id", procedureIds);
    linkedServiceId = procs?.find((p) => p.default_service_id)?.default_service_id ?? null;
  }

  if (!procedureIds.length) {
    warnings.push("Selecione pelo menos um procedimento para unificar serviço, insumos e cobrança.");
  }

  let linkedServiceName: string | null = null;
  if (linkedServiceId) {
    const { data: svc } = await supabase.from("services").select("nome").eq("id", linkedServiceId).single();
    linkedServiceName = svc?.nome ?? null;
  }

  const totalAmount = computeChargeTotal(serviceAmount, materialLines);

  return {
    error: null,
    data: {
      serviceAmount: Number(serviceAmount.toFixed(2)),
      materialsAmount: Number(materialsAmount.toFixed(2)),
      totalAmount,
      materialLines,
      linkedServiceId,
      linkedServiceName,
      warnings,
    },
  };
}

export type AppointmentEventSummary = {
  id: string;
  scheduled_at: string;
  status: string;
  valor: number | null;
  patient: { id: string; full_name: string; phone: string | null };
  doctor: { id: string; full_name: string | null } | null;
  appointment_type_name: string | null;
  service_name: string | null;
  procedures: { id: string; name: string }[];
  charge: {
    serviceAmount: number;
    materialsAmount: number;
    totalAmount: number;
    materialLines: { product_name: string; quantity: number; line_total: number }[];
  };
  stockCommittedUnits: number;
  encounterStatus: string | null;
  comanda: {
    id: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    remainder: number;
  } | null;
};

export async function getAppointmentEventSummary(
  appointmentId: string
): Promise<{ error: string | null; data: AppointmentEventSummary | null }> {
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

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      valor,
      doctor_id,
      service_id,
      patient:patients ( id, full_name, phone ),
      doctor:profiles!doctor_id ( id, full_name ),
      appointment_type:appointment_types ( name ),
      procedure:procedures!procedure_id ( id, name )
    `
    )
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (apptErr || !appt) return { error: "Consulta não encontrada.", data: null };

  const procedures = await loadAppointmentProcedures(supabase, appointmentId, appt.procedure);
  const { data: dimRows } = await supabase
    .from("appointment_dimension_values")
    .select("dimension_value_id")
    .eq("appointment_id", appointmentId);
  const dimensionValueIds = (dimRows ?? []).map((r) => r.dimension_value_id as string);

  const chargeRes = await getAppointmentChargePreview(
    procedures.map((p) => p.id),
    appt.doctor_id as string,
    appt.service_id as string | null,
    dimensionValueIds
  );

  const { data: consumption } = await supabase
    .from("appointment_consumption_lines")
    .select("quantity")
    .eq("appointment_id", appointmentId);
  const stockCommittedUnits = (consumption ?? []).reduce((s, l) => s + Number(l.quantity), 0);

  const { data: encounter } = await supabase
    .from("encounters")
    .select("status")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const { data: comandaRow } = await supabase
    .from("comandas")
    .select("id, status, total_amount, paid_amount")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
  const doctor = Array.isArray(appt.doctor) ? appt.doctor[0] : appt.doctor;
  const at = Array.isArray(appt.appointment_type) ? appt.appointment_type[0] : appt.appointment_type;
  const service_name = await loadServiceName(supabase, appt.service_id as string | null);

  const charge = chargeRes.data ?? {
    serviceAmount: Number(appt.valor) || 0,
    materialsAmount: 0,
    totalAmount: Number(appt.valor) || 0,
    materialLines: [],
    linkedServiceId: null,
    linkedServiceName: null,
    warnings: [],
  };

  return {
    error: null,
    data: {
      id: appt.id as string,
      scheduled_at: appt.scheduled_at as string,
      status: appt.status as string,
      valor: appt.valor != null ? Number(appt.valor) : null,
      patient: {
        id: String((patient as { id: string }).id),
        full_name: String((patient as { full_name: string }).full_name),
        phone: (patient as { phone?: string | null }).phone ?? null,
      },
      doctor: doctor
        ? {
            id: String((doctor as { id: string }).id),
            full_name: (doctor as { full_name?: string | null }).full_name ?? null,
          }
        : null,
      appointment_type_name: (at as { name?: string })?.name ?? null,
      service_name,
      procedures,
      charge: {
        serviceAmount: charge.serviceAmount,
        materialsAmount: charge.materialsAmount,
        totalAmount: charge.totalAmount,
        materialLines: charge.materialLines.map((l) => ({
          product_name: l.product_name,
          quantity: l.quantity,
          line_total: l.line_total,
        })),
      },
      stockCommittedUnits,
      encounterStatus: encounter?.status ?? null,
      comanda: comandaRow
        ? {
            id: comandaRow.id,
            status: comandaRow.status as string,
            total_amount: Number(comandaRow.total_amount),
            paid_amount: Number(comandaRow.paid_amount),
            remainder: Math.max(0, Number(comandaRow.total_amount) - Number(comandaRow.paid_amount)),
          }
        : null,
    },
  };
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
  linkedFormTemplateIds?: string[],
  serviceId?: string | null,
  valor?: number | null,
  dimensionValueIds?: string[],
  procedureIds?: string[]
) {
  const allProcedureIds =
    procedureIds?.length
      ? procedureIds
      : procedureId
        ? [procedureId]
        : [];
  const primaryProcedureId = allProcedureIds[0] ?? procedureId ?? null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
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

  // Verificar conflito de horário (mesmo médico, considerando duração do tipo de consulta)
  const durationMinutes = await getDurationMinutes(supabase, appointmentTypeId, profile.clinic_id);
  const conflictError = await checkAppointmentConflict(supabase, {
    clinicId: profile.clinic_id,
    doctorId,
    scheduledAt,
    durationMinutes,
    excludeAppointmentId: null,
  });
  if (conflictError) return { error: conflictError };

  const { data: appointment, error: insertErr } = await supabase
    .from("appointments")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_type_id: appointmentTypeId || null,
      procedure_id: primaryProcedureId,
      service_id: serviceId || null,
      valor: valor ?? null,
      scheduled_at: scheduledAt,
      status: "agendada",
      notes: notes || null,
      recommendations: recommendations || null,
      requires_fasting: requiresFasting || false,
      requires_medication_stop: requiresMedicationStop || false,
      special_instructions: specialInstructions || null,
      preparation_notes: preparationNotes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!appointment) return { error: "Erro ao criar consulta." };

  if (allProcedureIds.length) {
    await syncAppointmentProcedures(supabase, appointment.id, allProcedureIds);
    await buildConsumptionFromProcedures(supabase, appointment.id, allProcedureIds);
    try {
      await commitStockForAppointment(supabase, profile.clinic_id, appointment.id, user.id);
    } catch (e) {
      console.error("[createAppointment] stock commit:", e);
    }
  }

  if (dimensionValueIds?.length && appointment.id) {
    await supabase.from("appointment_dimension_values").insert(
      dimensionValueIds.map((dimension_value_id) => ({
        appointment_id: appointment.id,
        dimension_value_id,
      }))
    );
  }

  try {
    const { insertAuditLog } = await import("@/lib/audit-log");
    await insertAuditLog(supabase, {
      clinic_id: profile.clinic_id,
      user_id: user.id,
      action: "appointment_created",
      entity_type: "appointment",
      entity_id: appointment.id,
      new_values: { patient_id: patientId, doctor_id: doctorId, scheduled_at: scheduledAt, status: "agendada" },
    });
  } catch (_) {}

  // Secretária que agenda: associar paciente a ela (permite múltiplas secretárias por paciente)
  if (profile?.role === "secretaria") {
    await supabase
      .from("patient_secretary")
      .upsert(
        {
          clinic_id: profile.clinic_id,
          patient_id: patientId,
          secretary_id: user.id,
        },
        { onConflict: "clinic_id,patient_id,secretary_id" }
      );
    await linkWhatsAppConversationToSecretary(supabase, profile.clinic_id, patientId, user.id);
  }

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

  // Formulários vinculados ao(s) procedimento(s)
  for (const procId of allProcedureIds) {
    const { data: procLinks, error: procLinksError } = await supabase
      .from("form_template_procedures")
      .select("form_template_id")
      .eq("procedure_id", procId);
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

async function getDurationMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentTypeId: string | null,
  clinicId: string
): Promise<number> {
  if (!appointmentTypeId) return 30;
  const { data: at } = await supabase
    .from("appointment_types")
    .select("duration_minutes")
    .eq("id", appointmentTypeId)
    .eq("clinic_id", clinicId)
    .single();
  return at?.duration_minutes ?? 30;
}

function dayBoundsForScheduledAt(scheduledAt: string): { dayStart: string; dayEnd: string } {
  const d = new Date(scheduledAt);
  const dayStart = new Date(d);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(d);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() };
}

function formatConflictTimeRange(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(startMs)} às ${fmt(endMs)}`;
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

async function buildDurationMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  appointmentTypeIds: (string | null)[]
): Promise<Map<string, number>> {
  const ids = [...new Set(appointmentTypeIds.filter(Boolean))] as string[];
  const map = new Map<string, number>();
  if (!ids.length) return map;
  const { data: types } = await supabase
    .from("appointment_types")
    .select("id, duration_minutes")
    .eq("clinic_id", clinicId)
    .in("id", ids);
  for (const t of types ?? []) {
    map.set(t.id, t.duration_minutes ?? 30);
  }
  return map;
}

function appointmentEndMs(
  scheduledAt: string,
  appointmentTypeId: string | null,
  durationMap: Map<string, number>
): number {
  const start = new Date(scheduledAt).getTime();
  const duration =
    appointmentTypeId && durationMap.has(appointmentTypeId)
      ? durationMap.get(appointmentTypeId)!
      : 30;
  return start + duration * 60 * 1000;
}

async function getClinicAgendaMaxConcurrent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string
): Promise<number | null> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("agenda_max_concurrent")
    .eq("id", clinicId)
    .single();
  const n = clinic?.agenda_max_concurrent;
  if (n == null || n < 2) return null;
  return n;
}

async function checkAppointmentConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    clinicId: string;
    doctorId: string;
    scheduledAt: string;
    durationMinutes: number;
    excludeAppointmentId: string | null;
  }
): Promise<string | null> {
  const start = new Date(opts.scheduledAt).getTime();
  const end = start + opts.durationMinutes * 60 * 1000;
  const { dayStart, dayEnd } = dayBoundsForScheduledAt(opts.scheduledAt);

  const { data: doctor } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", opts.doctorId)
    .single();
  const doctorName = (doctor?.full_name as string | undefined)?.trim() || "este profissional";

  let doctorQuery = supabase
    .from("appointments")
    .select("id, scheduled_at, appointment_type_id")
    .eq("clinic_id", opts.clinicId)
    .eq("doctor_id", opts.doctorId)
    .neq("status", "cancelada")
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (opts.excludeAppointmentId) {
    doctorQuery = doctorQuery.neq("id", opts.excludeAppointmentId);
  }

  const { data: doctorDayAppointments } = await doctorQuery;

  const durationMap = await buildDurationMap(
    supabase,
    opts.clinicId,
    (doctorDayAppointments ?? []).map((a) => a.appointment_type_id)
  );

  for (const appt of doctorDayAppointments ?? []) {
    const apptStart = new Date(appt.scheduled_at).getTime();
    const apptEnd = appointmentEndMs(
      appt.scheduled_at,
      appt.appointment_type_id,
      durationMap
    );
    if (intervalsOverlap(start, end, apptStart, apptEnd)) {
      return `${doctorName} já tem consulta das ${formatConflictTimeRange(apptStart, apptEnd)}. Escolha outro horário.`;
    }
  }

  const maxConcurrent = await getClinicAgendaMaxConcurrent(supabase, opts.clinicId);
  if (!maxConcurrent) return null;

  let clinicQuery = supabase
    .from("appointments")
    .select("id, scheduled_at, appointment_type_id")
    .eq("clinic_id", opts.clinicId)
    .neq("status", "cancelada")
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (opts.excludeAppointmentId) {
    clinicQuery = clinicQuery.neq("id", opts.excludeAppointmentId);
  }

  const { data: clinicDayAppointments } = await clinicQuery;
  const clinicDurationMap = await buildDurationMap(
    supabase,
    opts.clinicId,
    (clinicDayAppointments ?? []).map((a) => a.appointment_type_id)
  );

  let overlapping = 0;
  for (const appt of clinicDayAppointments ?? []) {
    const apptStart = new Date(appt.scheduled_at).getTime();
    const apptEnd = appointmentEndMs(
      appt.scheduled_at,
      appt.appointment_type_id,
      clinicDurationMap
    );
    if (intervalsOverlap(start, end, apptStart, apptEnd)) overlapping += 1;
  }

  if (overlapping >= maxConcurrent) {
    return `A clínica permite no máximo ${maxConcurrent} consulta(s) simultânea(s) (${maxConcurrent} consultório(s)). Já há ${overlapping} neste horário. Escolha outro horário.`;
  }

  return null;
}

export type AppointmentEditData = {
  patientId: string;
  doctorId: string;
  appointmentTypeId: string;
  procedureIds: string[];
  serviceId: string;
  dimensionSelections: Record<string, string>;
  date: string;
  time: string;
  notes: string;
  recommendations: string;
  requiresFasting: boolean;
  requiresMedicationStop: boolean;
  specialInstructions: string;
  preparationNotes: string;
  valor: number | null;
};

/** Carrega dados da consulta para o modal de edição (abas). */
export async function getAppointmentForEdit(appointmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const { data: appt, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      patient_id,
      doctor_id,
      appointment_type_id,
      procedure_id,
      service_id,
      valor,
      scheduled_at,
      notes,
      recommendations,
      requires_fasting,
      requires_medication_stop,
      special_instructions,
      preparation_notes,
      status,
      appointment_procedures ( procedure_id, sort_order ),
      appointment_dimension_values ( dimension_value_id, dimension_values ( dimension_id ) )
    `
    )
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (error || !appt) return { error: error?.message ?? "Consulta não encontrada.", data: null };

  const scheduled = new Date(appt.scheduled_at as string);
  const procedureIds = (appt.appointment_procedures as { procedure_id: string; sort_order: number }[] | null)
    ?.sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.procedure_id) ?? [];
  const finalProcedureIds =
    procedureIds.length > 0
      ? procedureIds
      : appt.procedure_id
        ? [appt.procedure_id as string]
        : [];

  const dimensionSelections: Record<string, string> = {};
  for (const row of (appt.appointment_dimension_values as {
    dimension_value_id: string;
    dimension_values: { dimension_id: string } | { dimension_id: string }[];
  }[]) ?? []) {
    const dv = Array.isArray(row.dimension_values) ? row.dimension_values[0] : row.dimension_values;
    if (dv?.dimension_id) dimensionSelections[dv.dimension_id] = row.dimension_value_id;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())}`;
  const time = `${pad(scheduled.getHours())}:${pad(scheduled.getMinutes())}`;

  const data: AppointmentEditData = {
    patientId: appt.patient_id as string,
    doctorId: appt.doctor_id as string,
    appointmentTypeId: (appt.appointment_type_id as string) ?? "",
    procedureIds: finalProcedureIds,
    serviceId: (appt.service_id as string) ?? "",
    dimensionSelections,
    date,
    time,
    notes: (appt.notes as string) ?? "",
    recommendations: (appt.recommendations as string) ?? "",
    requiresFasting: !!appt.requires_fasting,
    requiresMedicationStop: !!appt.requires_medication_stop,
    specialInstructions: (appt.special_instructions as string) ?? "",
    preparationNotes: (appt.preparation_notes as string) ?? "",
    valor: appt.valor != null ? Number(appt.valor) : null,
  };

  return { error: null, data, status: appt.status as string };
}

export async function updateAppointment(
  id: string,
  data: {
    patient_id?: string;
    doctor_id?: string;
    appointment_type_id?: string | null;
    procedure_id?: string | null;
    procedure_ids?: string[];
    service_id?: string | null;
    valor?: number | null;
    scheduled_at?: string;
    status?: string;
    notes?: string | null;
    recommendations?: string | null;
    requires_fasting?: boolean;
    requires_medication_stop?: boolean;
    special_instructions?: string | null;
    preparation_notes?: string | null;
    dimension_value_ids?: string[];
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Verificar conflito se alterar data/hora, médico ou tipo
  const changesTimeOrDoctor =
    data.scheduled_at != null || data.doctor_id != null || data.appointment_type_id != null;
  if (changesTimeOrDoctor) {
    const { data: current } = await supabase
      .from("appointments")
      .select("clinic_id, doctor_id, scheduled_at, appointment_type_id")
      .eq("id", id)
      .single();
    if (current) {
      const clinicId = current.clinic_id;
      const doctorId = data.doctor_id ?? current.doctor_id;
      const scheduledAt = data.scheduled_at ?? current.scheduled_at;
      const appointmentTypeId = data.appointment_type_id ?? current.appointment_type_id;
      const durationMinutes = await getDurationMinutes(supabase, appointmentTypeId, clinicId);
      const conflictError = await checkAppointmentConflict(supabase, {
        clinicId,
        doctorId,
        scheduledAt,
        durationMinutes,
        excludeAppointmentId: id,
      });
      if (conflictError) return { error: conflictError };
    }
  }

  const { data: currentRow } = await supabase
    .from("appointments")
    .select("clinic_id, status, scheduled_at, doctor_id, patient_id, started_at, treatment_plan_id")
    .eq("id", id)
    .single();

  const procedureIds = data.procedure_ids;
  const dimensionValueIds = data.dimension_value_ids;
  const {
    procedure_ids: _pids,
    dimension_value_ids: _dvids,
    ...appointmentFields
  } = data;

  const updatePayload: Record<string, unknown> = {
    ...appointmentFields,
    updated_at: new Date().toISOString(),
  };

  if (procedureIds !== undefined) {
    updatePayload.procedure_id = procedureIds[0] ?? null;
  }

  if (data.status === "realizada" && currentRow?.started_at) {
    const startedAt = new Date(currentRow.started_at as string).getTime();
    const now = Date.now();
    updatePayload.completed_at = new Date(now).toISOString();
    updatePayload.duration_minutes = Math.round((now - startedAt) / 60000);
  }

  const { error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id);
  if (error) return { error: error.message };

  if (currentRow?.clinic_id) {
    if (procedureIds !== undefined) {
      const ids = procedureIds;
      const status = currentRow.status as string;
      const canAdjustStock = status !== "realizada" && status !== "cancelada" && status !== "falta";
      if (canAdjustStock) {
        try {
          await releaseStockForAppointment(supabase, currentRow.clinic_id, id, user.id);
        } catch (e) {
          console.error("[updateAppointment] stock release (procedures):", e);
        }
      }
      await syncAppointmentProcedures(supabase, id, ids);
      await buildConsumptionFromProcedures(supabase, id, ids);
      if (canAdjustStock) {
        try {
          await commitStockForAppointment(supabase, currentRow.clinic_id, id, user.id);
        } catch (e) {
          console.error("[updateAppointment] stock commit (procedures):", e);
        }
      }
    }
    if (dimensionValueIds !== undefined) {
      await supabase.from("appointment_dimension_values").delete().eq("appointment_id", id);
      if (dimensionValueIds.length) {
        await supabase.from("appointment_dimension_values").insert(
          dimensionValueIds.map((dimension_value_id) => ({
            appointment_id: id,
            dimension_value_id,
          }))
        );
      }
    }
    const prevStatus = currentRow.status as string;
    // Baixa de estoque ocorre na finalização da comanda (atendimento), não ao marcar realizada.
    if (
      (data.status === "cancelada" || data.status === "falta") &&
      prevStatus !== data.status &&
      prevStatus !== "realizada"
    ) {
      try {
        await releaseStockForAppointment(supabase, currentRow.clinic_id, id, user.id);
      } catch (e) {
        console.error("[updateAppointment] stock release:", e);
      }
      if (currentRow.treatment_plan_id) {
        try {
          const { recalcTreatmentPlanSessionsUsed } = await import("./treatment-plan-actions");
          await recalcTreatmentPlanSessionsUsed(String(currentRow.treatment_plan_id));
        } catch (e) {
          console.error("[updateAppointment] plan sessions recalc:", e);
        }
      }
    }
  }

  try {
    if (currentRow?.clinic_id) {
      const { data: { user } } = await supabase.auth.getUser();
      const { insertAuditLog } = await import("@/lib/audit-log");
      await insertAuditLog(supabase, {
        clinic_id: currentRow.clinic_id,
        user_id: user?.id ?? null,
        action: "appointment_updated",
        entity_type: "appointment",
        entity_id: id,
        old_values: currentRow as unknown as Record<string, unknown>,
        new_values: updatePayload,
      });
    }
  } catch (_) {}

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

/** Iniciar consulta: médico chama o paciente. Grava started_at para duração e para a secretária ver. */
export async function startAppointmentConsultation(appointmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Perfil não encontrado." };

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, clinic_id, doctor_id, status, started_at")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!appointment) return { error: "Consulta não encontrada." };
  if (appointment.started_at) return { error: "Consulta já foi iniciada." };
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return { error: "Só é possível iniciar consultas agendadas ou confirmadas." };
  }

  const isDoctor = profile.role === "medico" && appointment.doctor_id === profile.id;
  const canStart = isDoctor || profile.role === "admin" || profile.role === "secretaria";
  if (!canStart) return { error: "Sem permissão para iniciar esta consulta." };

  const { error } = await supabase
    .from("appointments")
    .update({
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  return { error: null };
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("appointments")
    .select("clinic_id, patient_id, doctor_id, scheduled_at, status")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) return { error: error.message };
  try {
    if (row?.clinic_id) {
      const { data: { user } } = await supabase.auth.getUser();
      const { insertAuditLog } = await import("@/lib/audit-log");
      await insertAuditLog(supabase, {
        clinic_id: row.clinic_id,
        user_id: user?.id ?? null,
        action: "appointment_deleted",
        entity_type: "appointment",
        entity_id: id,
        old_values: row as unknown as Record<string, unknown>,
      });
    }
  } catch (_) {}
  revalidatePath("/dashboard/agenda");
  return { error: null };
}

export async function updateUserPreferences(preferences: {
  agenda_view_mode?: "timeline" | "calendar";
  agenda_timeline_granularity?: "day" | "week" | "month";
  agenda_calendar_granularity?: "week" | "month";
  agenda_status_filter?: string[];
  agenda_form_filter?: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
  agenda_filter_by_service_id?: string;
  agenda_color_by?: "status" | "dimension";
  agenda_color_by_dimension_id?: string;
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
