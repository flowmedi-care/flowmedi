"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import { getClinicPlanData, countMonthAppointments } from "@/lib/plan-helpers";
import { canCreateAppointment, getUpgradeMessage } from "@/lib/plan-gates";
import { findRetornoProcedureForClinic } from "@/lib/procedure-scheduling";

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
import {
  plannedDurationMinutes,
  validateScheduledInterval,
  buildScheduledEndFromDuration,
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
} from "@/lib/appointment-scheduling";
import { checkAppointmentConflict, clinicRequiresRoom } from "@/lib/appointment-conflicts";

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
  scheduled_end_at: string | null;
  planned_duration_minutes: number | null;
  room_name: string | null;
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
    subtotal_amount: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    remainder: number;
  } | null;
  comanda_items: { description: string; quantity: number; total_price: number }[];
  comanda_issued_at: string | null;
  forms: { id: string; template_name: string; status: string }[];
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
      scheduled_end_at,
      planned_duration_minutes,
      status,
      valor,
      doctor_id,
      service_id,
      room_id,
      patient:patients ( id, full_name, phone ),
      doctor:profiles!doctor_id ( id, full_name ),
      appointment_type:appointment_types ( name ),
      procedure:procedures!procedure_id ( id, name ),
      room:rooms ( name )
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
    .select("id, status, subtotal_amount, discount_amount, total_amount, paid_amount, issued_at")
    .eq("appointment_id", appointmentId)
    .neq("status", "cancelada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let comandaItems: { description: string; quantity: number; total_price: number }[] = [];
  if (comandaRow) {
    const { data: itemRows } = await supabase
      .from("comanda_items")
      .select("description, quantity, total_price")
      .eq("comanda_id", comandaRow.id)
      .order("created_at", { ascending: true });
    comandaItems = (itemRows ?? []).map((row) => ({
      description: String(row.description),
      quantity: Number(row.quantity),
      total_price: Number(row.total_price),
    }));
  }

  const { data: formRows } = await supabase
    .from("form_instances")
    .select("id, status, form_templates(name)")
    .eq("appointment_id", appointmentId);

  const forms = (formRows ?? []).map((row) => {
    const tpl = Array.isArray(row.form_templates) ? row.form_templates[0] : row.form_templates;
    return {
      id: String(row.id),
      template_name: String((tpl as { name?: string })?.name ?? "Formulário"),
      status: String(row.status),
    };
  });

  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
  const doctor = Array.isArray(appt.doctor) ? appt.doctor[0] : appt.doctor;
  const at = Array.isArray(appt.appointment_type) ? appt.appointment_type[0] : appt.appointment_type;
  const room = Array.isArray(appt.room) ? appt.room[0] : appt.room;
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
      scheduled_end_at: (appt.scheduled_end_at as string | null) ?? null,
      planned_duration_minutes:
        appt.planned_duration_minutes != null
          ? Number(appt.planned_duration_minutes)
          : null,
      room_name: (room as { name?: string } | null)?.name ?? null,
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
            subtotal_amount: Number(comandaRow.subtotal_amount ?? comandaRow.total_amount),
            discount_amount: Number(comandaRow.discount_amount ?? 0),
            total_amount: Number(comandaRow.total_amount),
            paid_amount: Number(comandaRow.paid_amount),
            remainder: Math.max(0, Number(comandaRow.total_amount) - Number(comandaRow.paid_amount)),
          }
        : null,
      comanda_items: comandaItems,
      comanda_issued_at: comandaRow?.issued_at != null ? String(comandaRow.issued_at) : null,
      forms,
    },
  };
}

export type CreateAppointmentOptions = {
  /** RECORRÊNCIA v1 — não bloqueia por conflito de horário (avisar na UI). */
  skipConflictCheck?: boolean;
  /** Admin: agendar mesmo com conflito (auditoria). */
  forceConflict?: boolean;
  recurrence_group_id?: string;
  session_number?: number;
  treatment_plan_id?: string | null;
  /** Evita revalidação a cada sessão em lote. */
  skipRevalidate?: boolean;
  scheduledEndAt?: string;
  roomId?: string | null;
  payment_policy?: "antecipado" | "no_dia" | "pos_atendimento" | null;
};

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
  procedureIds?: string[],
  options?: CreateAppointmentOptions
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

  const durationMinutes = await resolveDurationMinutes(supabase, {
    clinicId: profile.clinic_id,
    procedureIds: allProcedureIds,
    appointmentTypeId,
  });
  const scheduledEndAt =
    options?.scheduledEndAt ??
    buildScheduledEndFromDuration(scheduledAt, durationMinutes);
  const intervalCheck = validateScheduledInterval(scheduledAt, scheduledEndAt);
  if (!intervalCheck.ok) return { error: intervalCheck.error };

  const roomRequired = await clinicRequiresRoom(supabase, profile.clinic_id);
  if (roomRequired && !options?.roomId) {
    return { error: "Selecione a sala/consultório para agendar." };
  }

  if (!options?.skipConflictCheck && !options?.forceConflict) {
    const conflictError = await checkAppointmentConflict(supabase, {
      clinicId: profile.clinic_id,
      doctorId,
      scheduledAt,
      scheduledEndAt,
      roomId: options?.roomId ?? null,
      excludeAppointmentId: null,
    });
    if (conflictError) return { error: conflictError };
  }

  const insertRow: Record<string, unknown> = {
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    doctor_id: doctorId,
    appointment_type_id: null,
    procedure_id: primaryProcedureId,
    service_id: serviceId || null,
    valor: valor ?? null,
    scheduled_at: scheduledAt,
    scheduled_end_at: scheduledEndAt,
    planned_duration_minutes: plannedDurationMinutes(scheduledAt, scheduledEndAt),
    status: "agendada",
    notes: notes || null,
    recommendations: recommendations || null,
    requires_fasting: requiresFasting || false,
    requires_medication_stop: requiresMedicationStop || false,
    special_instructions: specialInstructions || null,
    preparation_notes: preparationNotes || null,
    created_by: user.id,
  };
  if (options?.recurrence_group_id) {
    insertRow.recurrence_group_id = options.recurrence_group_id;
  }
  if (options?.session_number != null) {
    insertRow.session_number = options.session_number;
  }
  if (options?.treatment_plan_id) {
    insertRow.treatment_plan_id = options.treatment_plan_id;
  }
  if (options?.roomId) {
    insertRow.room_id = options.roomId;
  }
  if (options?.payment_policy) {
    insertRow.payment_policy = options.payment_policy;
  }

  const { data: appointment, error: insertErr } = await supabase
    .from("appointments")
    .insert(insertRow)
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

  try {
    const { createScheduleComanda } = await import("./encounter-actions");
    await createScheduleComanda(appointment.id);
  } catch (e) {
    console.error("[createAppointment] schedule comanda:", e);
  }

  if (!options?.skipRevalidate) {
    revalidatePath("/dashboard/agenda");
    revalidatePath("/dashboard/eventos");
    revalidatePath("/dashboard");
  }
  return { data: { id: appointment.id }, error: null };
}

export type RecurrenceSlotInterval = {
  scheduledAt: string;
  scheduledEndAt: string;
};

// RECORRÊNCIA v1 — Verifica conflitos por slot (não bloqueia salvamento).
export async function checkRecurrenceSlotsConflicts(
  doctorId: string,
  slots: RecurrenceSlotInterval[],
  roomId?: string | null
): Promise<{ error: string | null; conflicts: boolean[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", conflicts: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", conflicts: [] };

  const conflicts: boolean[] = [];
  for (const slot of slots) {
    const msg = await checkAppointmentConflict(supabase, {
      clinicId: profile.clinic_id,
      doctorId,
      scheduledAt: slot.scheduledAt,
      scheduledEndAt: slot.scheduledEndAt,
      roomId: roomId ?? null,
      excludeAppointmentId: null,
    });
    conflicts.push(!!msg);
  }
  return { error: null, conflicts };
}

async function resolveDurationMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    clinicId: string;
    procedureIds?: string[];
    appointmentTypeId?: string | null;
  }
): Promise<number> {
  if (opts.procedureIds?.length) {
    const { data } = await supabase
      .from("procedures")
      .select("duration_minutes")
      .in("id", opts.procedureIds)
      .eq("clinic_id", opts.clinicId);
    if (data?.length) {
      return Math.max(...data.map((p) => Number(p.duration_minutes) || 30));
    }
  }
  if (opts.appointmentTypeId) {
    const { data: at } = await supabase
      .from("appointment_types")
      .select("duration_minutes")
      .eq("id", opts.appointmentTypeId)
      .eq("clinic_id", opts.clinicId)
      .single();
    if (at?.duration_minutes) return Number(at.duration_minutes);
  }
  return 30;
}

export type AppointmentEditData = {
  patientId: string;
  doctorId: string;
  procedureIds: string[];
  serviceId: string;
  dimensionSelections: Record<string, string>;
  date: string;
  time: string;
  endTime: string;
  roomId: string;
  notes: string;
  recommendations: string;
  requiresFasting: boolean;
  requiresMedicationStop: boolean;
  specialInstructions: string;
  preparationNotes: string;
  valor: number | null;
  paymentPolicy: "antecipado" | "no_dia" | "pos_atendimento" | null;
  treatmentPlanId: string | null;
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
      scheduled_end_at,
      room_id,
      notes,
      recommendations,
      requires_fasting,
      requires_medication_stop,
      special_instructions,
      preparation_notes,
      status,
      payment_policy,
      treatment_plan_id,
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
  const scheduledEnd = appt.scheduled_end_at
    ? new Date(appt.scheduled_end_at as string)
    : new Date(scheduled.getTime() + DEFAULT_APPOINTMENT_DURATION_MINUTES * 60000);
  const endTime = `${pad(scheduledEnd.getHours())}:${pad(scheduledEnd.getMinutes())}`;

  const data: AppointmentEditData = {
    patientId: appt.patient_id as string,
    doctorId: appt.doctor_id as string,
    procedureIds: finalProcedureIds,
    serviceId: (appt.service_id as string) ?? "",
    dimensionSelections,
    date,
    time,
    endTime,
    roomId: (appt.room_id as string) ?? "",
    notes: (appt.notes as string) ?? "",
    recommendations: (appt.recommendations as string) ?? "",
    requiresFasting: !!appt.requires_fasting,
    requiresMedicationStop: !!appt.requires_medication_stop,
    specialInstructions: (appt.special_instructions as string) ?? "",
    preparationNotes: (appt.preparation_notes as string) ?? "",
    valor: appt.valor != null ? Number(appt.valor) : null,
    paymentPolicy: (appt.payment_policy as AppointmentEditData["paymentPolicy"]) ?? null,
    treatmentPlanId: (appt.treatment_plan_id as string) ?? null,
  };

  return { error: null, data, status: appt.status as string };
}

export type WaitlistMatchAlert = {
  id: string;
  patientName: string;
  preferredDate: string;
};

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
    scheduled_end_at?: string;
    room_id?: string | null;
    status?: string;
    notes?: string | null;
    recommendations?: string | null;
    requires_fasting?: boolean;
    requires_medication_stop?: boolean;
    special_instructions?: string | null;
    preparation_notes?: string | null;
    payment_policy?: "antecipado" | "no_dia" | "pos_atendimento" | null;
    dimension_value_ids?: string[];
    forceConflict?: boolean;
    apply_retorno?: boolean;
  }
): Promise<{ error: string | null; waitlistMatches?: WaitlistMatchAlert[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: currentRow } = await supabase
    .from("appointments")
    .select(
      "clinic_id, status, scheduled_at, scheduled_end_at, doctor_id, patient_id, started_at, treatment_plan_id, room_id, appointment_type_id"
    )
    .eq("id", id)
    .single();

  let procedureIds = data.procedure_ids;
  const applyRetorno = data.apply_retorno === true;
  const {
    procedure_ids: _pids,
    dimension_value_ids: dimensionValueIds,
    apply_retorno: _applyRetorno,
    ...appointmentFields
  } = data;

  if (applyRetorno && currentRow?.clinic_id) {
    const retornoProc = await findRetornoProcedureForClinic(
      supabase,
      currentRow.clinic_id as string
    );
    if (retornoProc) {
      procedureIds = [retornoProc.id];
      appointmentFields.procedure_id = retornoProc.id;
      appointmentFields.service_id = retornoProc.default_service_id;
      appointmentFields.appointment_type_id = null;
    }
  }

  const changesTimeOrDoctor =
    data.scheduled_at != null ||
    data.scheduled_end_at != null ||
    data.doctor_id != null ||
    data.room_id != null;
  if (changesTimeOrDoctor && currentRow) {
    const clinicId = currentRow.clinic_id as string;
    const doctorId = (data.doctor_id ?? currentRow.doctor_id) as string;
    const scheduledAt = (data.scheduled_at ?? currentRow.scheduled_at) as string;
    let scheduledEndAt = (data.scheduled_end_at ?? currentRow.scheduled_end_at) as string | null;
    if (!scheduledEndAt) {
      const durationMinutes = await resolveDurationMinutes(supabase, {
        clinicId,
        procedureIds: procedureIds ?? undefined,
        appointmentTypeId: (data.appointment_type_id ?? currentRow.appointment_type_id) as
          | string
          | null,
      });
      scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, durationMinutes);
    }
    const intervalCheck = validateScheduledInterval(scheduledAt, scheduledEndAt);
    if (!intervalCheck.ok) return { error: intervalCheck.error };

    if (!data.forceConflict) {
      const conflictError = await checkAppointmentConflict(supabase, {
        clinicId,
        doctorId,
        scheduledAt,
        scheduledEndAt,
        roomId: data.room_id !== undefined ? data.room_id : (currentRow.room_id as string | null),
        excludeAppointmentId: id,
      });
      if (conflictError) return { error: conflictError };
    }
  }

  const updatePayload: Record<string, unknown> = {
    ...appointmentFields,
    updated_at: new Date().toISOString(),
  };

  if (data.scheduled_at != null || data.scheduled_end_at != null) {
    const scheduledAt = (data.scheduled_at ?? currentRow?.scheduled_at) as string;
    let scheduledEndAt = (data.scheduled_end_at ?? currentRow?.scheduled_end_at) as string | null;
    if (!scheduledEndAt && currentRow) {
      const durationMinutes = await resolveDurationMinutes(supabase, {
        clinicId: currentRow.clinic_id as string,
        procedureIds: procedureIds ?? undefined,
        appointmentTypeId: (data.appointment_type_id ?? currentRow.appointment_type_id) as
          | string
          | null,
      });
      scheduledEndAt = buildScheduledEndFromDuration(scheduledAt, durationMinutes);
    }
    if (scheduledEndAt) {
      updatePayload.planned_duration_minutes = plannedDurationMinutes(
        scheduledAt,
        scheduledEndAt
      );
    }
  }

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
        cancelada: "appointment_canceled",
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

  let waitlistMatches: WaitlistMatchAlert[] | undefined;
  try {
    if (currentRow) {
      const freedSlot = detectFreedSlotFromUpdate(currentRow as Record<string, unknown>, data);
      if (freedSlot) {
        const { findWaitlistMatchesForFreedSlot } = await import("./waitlist-actions");
        waitlistMatches = await findWaitlistMatchesForFreedSlot({
          clinicId: currentRow.clinic_id as string,
          doctorId: freedSlot.doctorId,
          roomId: freedSlot.roomId,
          scheduledAt: freedSlot.scheduledAt,
          scheduledEndAt: freedSlot.scheduledEndAt,
        });
      }
    }
  } catch (_) {}

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/eventos");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/agenda/consulta/${id}`);
  return { error: null, waitlistMatches };
}

function detectFreedSlotFromUpdate(
  currentRow: Record<string, unknown>,
  data: {
    scheduled_at?: string;
    scheduled_end_at?: string;
    status?: string;
  }
): {
  doctorId: string;
  roomId: string | null;
  scheduledAt: string;
  scheduledEndAt: string;
} | null {
  const prevStatus = String(currentRow.status ?? "");
  const cancelledNow =
    (data.status === "cancelada" || data.status === "falta") &&
    prevStatus !== data.status &&
    prevStatus !== "realizada";
  const rescheduled =
    data.scheduled_at != null &&
    data.scheduled_at !== currentRow.scheduled_at;

  if (!cancelledNow && !rescheduled) return null;

  const scheduledAt = String(currentRow.scheduled_at ?? "");
  const scheduledEndAt = String(
    currentRow.scheduled_end_at ??
      buildScheduledEndFromDuration(scheduledAt, DEFAULT_APPOINTMENT_DURATION_MINUTES)
  );
  return {
    doctorId: String(currentRow.doctor_id ?? ""),
    roomId: currentRow.room_id != null ? String(currentRow.room_id) : null,
    scheduledAt,
    scheduledEndAt,
  };
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
