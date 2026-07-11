import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiState } from "@/lib/chatbot/state/types";
import type { NormalizedFacts } from "@/lib/chatbot/extractors/types";
import type { ConversationFlowsConfig } from "@/lib/attendance-flow/types";
import type { AppointmentPolicy } from "@/lib/attendance-flow/types";
import { buildGoalRegistry } from "@/lib/attendance-flow/flow-sync";
import { loadPatientSlice, type PatientSlice } from "./snapshot/loaders/patient-loader";
import { loadPolicySlice, type PolicySlice } from "./snapshot/loaders/policy-loader";
import { loadAppointmentsSlice, type AppointmentSlice } from "./snapshot/loaders/appointments-loader";
import { loadFlowSlice } from "./snapshot/loaders/flow-loader";
import {
  computeIntakeGap,
  hydrateCollectedFromSnapshot,
  type IntakeGapItem,
} from "./snapshot/gap-resolver";
import {
  ensureConversationFlow,
  syncConversationFlowTurn,
  type ClinicFlowConfig,
} from "@/lib/attendance-flow/flow-sync";
import { evaluateGoalsFromEngine } from "./snapshot/goal-evaluator";
import { mergeAiState } from "@/lib/chatbot/state/patch";
import { normalizeAiState } from "@/lib/chatbot/state/migrate";

export type ConversationSnapshot = Readonly<{
  conversation: {
    id: string;
    clinicId: string;
    phoneNumber: string;
    patientId: string | null;
  };
  patient: PatientSlice | null;
  appointments: AppointmentSlice[];
  clinicPolicy: AppointmentPolicy;
  conversationFlow: ConversationFlowsConfig;
  flowConfig: ClinicFlowConfig;
  customFields: PolicySlice["customFields"];
  aiState: AiState;
  turnFacts: NormalizedFacts & Record<string, unknown>;
  derived: Readonly<{
    intakeGap: IntakeGapItem[];
    satisfiedGoals: string[];
    pendingGoals: string[];
    flowBlock: string;
    allowedTools: string[];
  }>;
}>;

export type BuildConversationSnapshotInput = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  patientId?: string | null;
  aiState: Record<string, unknown>;
  turnFacts?: NormalizedFacts & Record<string, unknown>;
  userText?: string;
  policySlice?: PolicySlice;
};

function freezeSnapshot<T extends object>(obj: T): T {
  if (process.env.NODE_ENV !== "production") {
    return Object.freeze(obj) as T;
  }
  return obj;
}

export async function buildConversationSnapshot(
  input: BuildConversationSnapshotInput
): Promise<ConversationSnapshot> {
  const policySlice =
    input.policySlice ?? (await loadPolicySlice(input.supabase, input.clinicId));
  const flowSlice = loadFlowSlice(policySlice);

  let aiState = normalizeAiState(input.aiState);
  const turnFacts = input.turnFacts ?? {};

  const patientId = input.patientId ?? aiState.patient_id ?? null;
  const patient = await loadPatientSlice(input.supabase, input.clinicId, {
    patientId: patientId ?? undefined,
    phone: patientId ? undefined : input.phoneNumber,
  });

  if (patient && !aiState.patient_id) {
    aiState = { ...aiState, patient_id: patient.id };
  }

  const appointments = await loadAppointmentsSlice(
    input.supabase,
    input.clinicId,
    patient?.id ?? patientId,
    { upcomingOnly: true }
  );

  const hydratedCollected = hydrateCollectedFromSnapshot({ patient, aiState, turnFacts });
  aiState = mergeAiState(aiState, {
    conversation_flow: {
      ...(aiState.conversation_flow ?? {
        active_workflow_id: "consulta",
        mode: "assisted",
        satisfied: [],
        pending: [],
      }),
      collected: hydratedCollected,
    },
  });

  const registry = buildGoalRegistry(policySlice.customFields);
  const intakeGap = computeIntakeGap({
    policy: policySlice.appointmentPolicy,
    registry,
    patient,
    aiState,
    turnFacts,
    customFields: policySlice.customFields,
  });

  const flowConfig: ClinicFlowConfig = {
    appointmentPolicy: policySlice.appointmentPolicy,
    conversationFlows: policySlice.conversationFlows,
    customFields: policySlice.customFields,
  };

  const userText = input.userText ?? "";
  const flowSync = syncConversationFlowTurn(
    aiState,
    userText,
    flowConfig,
    policySlice.customFields,
    patient,
    turnFacts
  );

  aiState = mergeAiState(aiState, flowSync.aiStatePatch);

  const engineInput = {
    ...flowSync.engineInput,
    aiState,
    patient: patient as Record<string, unknown> | null,
    turnFacts,
  };

  const { satisfied, pending } = evaluateGoalsFromEngine(engineInput);

  const snapshot: ConversationSnapshot = {
    conversation: {
      id: input.conversationId,
      clinicId: input.clinicId,
      phoneNumber: input.phoneNumber,
      patientId: patient?.id ?? patientId,
    },
    patient,
    appointments,
    clinicPolicy: policySlice.appointmentPolicy,
    conversationFlow: flowSlice.conversationFlows,
    flowConfig,
    customFields: policySlice.customFields,
    aiState,
    turnFacts,
    derived: {
      intakeGap,
      satisfiedGoals: satisfied,
      pendingGoals: pending,
      flowBlock: flowSync.flowBlock,
      allowedTools: flowSync.allowedTools,
    },
  };

  return freezeSnapshot(snapshot);
}

export function formatSnapshotForPrompt(snapshot: ConversationSnapshot): string {
  const lines: string[] = ["Contexto do snapshot (dados já conhecidos):"];

  if (snapshot.patient) {
    lines.push(`- Paciente: ${snapshot.patient.display_name} (id: ${snapshot.patient.id})`);
    if (snapshot.patient.cpf) lines.push("- CPF já cadastrado — não peça novamente.");
    if (snapshot.patient.email) lines.push(`- E-mail no cadastro: ${snapshot.patient.email}`);
  } else {
    lines.push("- Paciente ainda não identificado no cadastro.");
  }

  if (snapshot.turnFacts.cpf) lines.push(`- CPF informado nesta mensagem: ${snapshot.turnFacts.cpf}`);
  if (snapshot.turnFacts.email) lines.push(`- E-mail informado nesta mensagem: ${snapshot.turnFacts.email}`);
  if (snapshot.turnFacts.selected_hour) {
    lines.push(`- Horário escolhido (extraído): ${snapshot.turnFacts.selected_hour}`);
  }
  if (snapshot.turnFacts.confirmed === true) lines.push("- Paciente confirmou (sim).");
  if (snapshot.turnFacts.confirmed === false) lines.push("- Paciente negou.");

  const booking = snapshot.aiState.booking;
  if (booking?.pending_slot) {
    lines.push(
      `- Horário selecionado para agendar: ${booking.pending_slot} (use este scheduled_at em create_appointment).`
    );
  }
  if ((booking?.offered_slots?.length ?? 0) > 0) {
    lines.push("", "Horários oferecidos (ISO para create_appointment):");
    booking!.offered_slots!.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.display} → ${s.scheduled_at}`);
    });
  }

  if (snapshot.derived.intakeGap.length) {
    lines.push(
      "",
      "Campos ainda faltantes (pergunte SOMENTE estes se relevante ao fluxo):"
    );
    for (const g of snapshot.derived.intakeGap) {
      lines.push(`- ${g.label}${g.required ? " (obrigatório)" : " (opcional)"}`);
    }
  } else {
    lines.push("", "Cadastro completo para os campos configurados — não peça CPF/dados já presentes.");
  }

  if (snapshot.appointments.length) {
    lines.push("", `Consultas futuras: ${snapshot.appointments.length}`);
  }

  return lines.join("\n");
}

export { ensureConversationFlow };
