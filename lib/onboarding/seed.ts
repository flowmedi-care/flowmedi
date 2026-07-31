import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCaseCommands } from "@/lib/case-management/apply-commands";
import { insertCase } from "@/lib/case-management/repository";
import { contactIdFromLead } from "@/lib/case-management/types";
import { MARIA_STORY } from "./copy";
import { trackProductEvent } from "./events";
import { getOnboardingState, patchOnboardingClinic } from "./state";
import type { OnboardingDemoBundle } from "./types";

const DEMO_SERVICE_NAME = "Consulta avaliação (demo)";
const DEMO_PROCEDURE_NAME = "Avaliação (demo)";
const DEMO_ROOM_NAME = "Consultório 1 (demo)";
const DEMO_PRICE = 250;

/**
 * Provisiona o bundle Maria: serviço, procedimento, preço, sala (se necessário),
 * paciente, lead, case com pendência. Admin já atende (admin_also_practices).
 */
export async function seedClinicDemoBundle(
  supabase: SupabaseClient,
  params: { clinicId: string; adminUserId: string; adminFullName?: string | null }
): Promise<{ bundle: OnboardingDemoBundle | null; caseId: string | null; error: string | null }> {
  const existing = await getOnboardingState(supabase, params.clinicId);
  if (existing?.bundle?.caseId && existing.demoSeededAt) {
    return {
      bundle: existing.bundle,
      caseId: existing.bundle.caseId,
      error: null,
    };
  }

  // Garantir admin_also_practices
  await patchOnboardingClinic(supabase, params.clinicId, {
    admin_also_practices: true,
  });

  const { data: service, error: serviceErr } = await supabase
    .from("services")
    .insert({
      clinic_id: params.clinicId,
      nome: DEMO_SERVICE_NAME,
      categoria: "Demo",
    })
    .select("id")
    .single();
  if (serviceErr || !service) {
    return { bundle: null, caseId: null, error: serviceErr?.message ?? "Falha ao criar serviço demo" };
  }

  const { data: procedure, error: procErr } = await supabase
    .from("procedures")
    .insert({
      clinic_id: params.clinicId,
      name: DEMO_PROCEDURE_NAME,
      display_order: 0,
      default_service_id: service.id,
      duration_minutes: 30,
      short_description: MARIA_STORY.reasonLabel,
    })
    .select("id")
    .single();
  if (procErr || !procedure) {
    return { bundle: null, caseId: null, error: procErr?.message ?? "Falha ao criar procedimento demo" };
  }

  const { data: price, error: priceErr } = await supabase
    .from("service_prices")
    .insert({
      clinic_id: params.clinicId,
      service_id: service.id,
      professional_id: params.adminUserId,
      valor: DEMO_PRICE,
      ativo: true,
    })
    .select("id")
    .single();
  if (priceErr || !price) {
    return { bundle: null, caseId: null, error: priceErr?.message ?? "Falha ao criar preço demo" };
  }

  let roomId: string | undefined;
  const { count: roomsCount } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", params.clinicId);
  // Sempre criar sala demo para evitar bloqueio se a clínica passar a exigir salas
  if ((roomsCount ?? 0) === 0) {
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({
        clinic_id: params.clinicId,
        name: DEMO_ROOM_NAME,
        display_order: 0,
      })
      .select("id")
      .single();
    if (roomErr || !room) {
      return { bundle: null, caseId: null, error: roomErr?.message ?? "Falha ao criar sala demo" };
    }
    roomId = String(room.id);
  }

  const stamp = Date.now();
  const { data: patient, error: patientErr } = await supabase
    .from("patients")
    .insert({
      clinic_id: params.clinicId,
      full_name: MARIA_STORY.name,
      email: `maria.demo+${stamp}@flowmedi.local`,
      phone: null,
      notes: `${MARIA_STORY.channelDetail}\n\n[demo] Paciente de ativação — pode apagar.`,
      custom_fields: { is_onboarding_demo: true },
    })
    .select("id")
    .single();
  if (patientErr || !patient) {
    return { bundle: null, caseId: null, error: patientErr?.message ?? "Falha ao criar paciente demo" };
  }

  const { data: lead, error: leadErr } = await supabase
    .from("non_registered_pipeline")
    .insert({
      clinic_id: params.clinicId,
      name: MARIA_STORY.name,
      email: `maria.demo+${stamp}@flowmedi.local`,
      phone: null,
      stage: "novo_contato",
      lifecycle_stage: "lead_novo",
      next_action: "Qualificar e agendar avaliação",
      patient_id: patient.id,
      notes: MARIA_STORY.channelDetail,
      source: "manual",
    })
    .select("id")
    .single();

  // patient_id / notes podem não existir na tabela — retry sem campos extras
  let leadId: string;
  if (leadErr || !lead) {
    const { data: lead2, error: leadErr2 } = await supabase
      .from("non_registered_pipeline")
      .insert({
        clinic_id: params.clinicId,
        name: MARIA_STORY.name,
        email: `maria.demo+${stamp}@flowmedi.local`,
        phone: null,
        stage: "novo_contato",
        lifecycle_stage: "lead_novo",
        next_action: "Qualificar e agendar avaliação",
        source: "manual",
      })
      .select("id")
      .single();
    if (leadErr2 || !lead2) {
      return {
        bundle: null,
        caseId: null,
        error: leadErr2?.message ?? leadErr?.message ?? "Falha ao criar lead demo",
      };
    }
    leadId = String(lead2.id);
  } else {
    leadId = String(lead.id);
  }

  const journeyCase = await insertCase(supabase, {
    clinic_id: params.clinicId,
    contact_id: contactIdFromLead(leadId),
    lead_id: leadId,
    patient_id: String(patient.id),
    process_type_code: "primeira_consulta",
    owner_type: "human",
    owner_id: params.adminUserId,
  });

  if (!journeyCase) {
    return { bundle: null, caseId: null, error: "Falha ao criar atendimento demo" };
  }

  await applyCaseCommands(
    supabase,
    [
      {
        type: "SetPendingDecision",
        caseId: journeyCase.id,
        pending: {
          type: "qualify_lead",
          waiting_for: "secretaria",
          label: "Qualificar Maria e agendar avaliação",
          due_at: null,
        },
      },
    ],
    {
      clinicId: params.clinicId,
      sourceEventId: null,
      actor: `human:${params.adminUserId}`,
      skipSetPhase: true,
    }
  );

  const bundle: OnboardingDemoBundle = {
    leadId,
    caseId: journeyCase.id,
    patientId: String(patient.id),
    serviceId: String(service.id),
    procedureId: String(procedure.id),
    roomId,
    doctorId: params.adminUserId,
    servicePriceId: String(price.id),
    story: {
      name: MARIA_STORY.name,
      channelLabel: MARIA_STORY.channelLabel,
      reasonLabel: MARIA_STORY.reasonLabel,
      isDemo: true,
    },
  };

  const patchErr = await patchOnboardingClinic(supabase, params.clinicId, {
    onboarding_demo_bundle: bundle,
    onboarding_demo_seeded_at: new Date().toISOString(),
    onboarding_tour_step: "contact",
    admin_also_practices: true,
  });
  if (patchErr.error) {
    return { bundle, caseId: journeyCase.id, error: patchErr.error };
  }

  await trackProductEvent(supabase, {
    clinicId: params.clinicId,
    userId: params.adminUserId,
    event: "demo_seeded",
    properties: { caseId: journeyCase.id },
  });

  return { bundle, caseId: journeyCase.id, error: null };
}
