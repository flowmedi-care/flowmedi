"use server";

import { createClient } from "@/lib/supabase/server";
import { applyCaseCommands } from "@/lib/case-management/apply-commands";
import { insertCase } from "@/lib/case-management/repository";
import { contactIdFromLead } from "@/lib/case-management/types";

/**
 * TTFS: cria lead + Case com pending humana e retorna caseId (sem Meta).
 */
export async function createDemoAtendimentoAction(): Promise<{
  caseId: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { caseId: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role, id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "admin") {
    return { caseId: null, error: "Apenas admin pode criar demo." };
  }

  const clinicId = profile.clinic_id;
  const stamp = Date.now();

  const { data: lead, error: leadErr } = await supabase
    .from("non_registered_pipeline")
    .insert({
      clinic_id: clinicId,
      name: `Paciente demo ${stamp}`,
      email: `demo+${stamp}@flowmedi.local`,
      phone: null,
      stage: "novo",
      lifecycle_stage: "novo",
      next_action: "Confirmar interesse / agendar",
    })
    .select("id")
    .single();

  if (leadErr || !lead) {
    return { caseId: null, error: leadErr?.message ?? "Falha ao criar lead demo" };
  }

  const journeyCase = await insertCase(supabase, {
    clinic_id: clinicId,
    contact_id: contactIdFromLead(String(lead.id)),
    lead_id: String(lead.id),
    patient_id: null,
    process_type_code: "primeira_consulta",
    owner_type: "human",
    owner_id: profile.id,
  });

  if (!journeyCase) {
    return { caseId: null, error: "Falha ao criar atendimento demo" };
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
          label: "Qualificar contato demo e agendar",
          due_at: null,
        },
      },
    ],
    {
      clinicId,
      sourceEventId: null,
      actor: `human:${profile.id}`,
      skipSetPhase: true,
    }
  );

  return { caseId: journeyCase.id, error: null };
}
