import type { GoalRegistry } from "@/lib/attendance-flow/goal-registry";
import type { AppointmentPolicy, CustomFieldForGoals } from "@/lib/attendance-flow/types";
import { resolveEffectivePolicy } from "@/lib/attendance-flow/engine";
import {
  GOAL_SEMANTIC_KEYS,
  isFilled,
  mergeCollectedSources,
  resolveSemanticValue,
  type GoalResolverContext,
} from "@/lib/attendance-flow/data-resolver";
import type { PatientSlice } from "./loaders/patient-loader";
import type { NormalizedFacts } from "@/lib/chatbot/extractors/types";
import type { AiState } from "@/lib/chatbot/state/types";

export type IntakeGapItem = {
  goal_id: string;
  label: string;
  required: boolean;
};

const GOAL_LABELS: Record<string, string> = {
  cpf: "CPF",
  email: "E-mail",
  insurance: "Convênio",
  payment_method: "Forma de pagamento",
  guardian: "Responsável",
  cancel_reason: "Motivo do cancelamento",
};

function buildResolverCtx(
  patient: PatientSlice | null,
  aiState: AiState,
  turnFacts: NormalizedFacts & Record<string, unknown>
): GoalResolverContext {
  return {
    aiState,
    collected: mergeCollectedSources(aiState),
    patient: patient
      ? {
          cpf: patient.cpf,
          email: patient.email,
          age: patient.age,
          custom_fields: patient.custom_fields,
        }
      : null,
    turnFacts,
  };
}

export function computeIntakeGap(input: {
  policy: AppointmentPolicy;
  registry: GoalRegistry;
  patient: PatientSlice | null;
  aiState: AiState;
  turnFacts: NormalizedFacts & Record<string, unknown>;
  customFields: CustomFieldForGoals[];
}): IntakeGapItem[] {
  const ctx = buildResolverCtx(input.patient, input.aiState, input.turnFacts);
  const gap: IntakeGapItem[] = [];

  for (const [goalId, meta] of Object.entries(GOAL_SEMANTIC_KEYS)) {
    const pol = resolveEffectivePolicy(goalId, input.registry, input.policy);
    if (pol === "ignore") continue;
    const val = resolveSemanticValue(meta.field, ctx, { patientKey: meta.patientKey });
    if (!isFilled(val)) {
      gap.push({
        goal_id: goalId,
        label: GOAL_LABELS[goalId] ?? goalId,
        required: pol === "required",
      });
    }
  }

  for (const cf of input.customFields) {
    if (cf.whatsapp_policy === "ignore") continue;
    const val = resolveSemanticValue(cf.field_name, ctx, { customFieldName: cf.field_name });
    if (!isFilled(val)) {
      gap.push({
        goal_id: `custom:${cf.id}`,
        label: cf.field_label,
        required: cf.whatsapp_policy === "required",
      });
    }
  }

  return gap;
}

export function hydrateCollectedFromSnapshot(input: {
  patient: PatientSlice | null;
  aiState: AiState;
  turnFacts: NormalizedFacts & Record<string, unknown>;
}): Record<string, unknown> {
  const base = { ...(input.aiState.conversation_flow?.collected ?? {}) };
  const ctx = buildResolverCtx(input.patient, input.aiState, input.turnFacts);

  for (const [goalId, meta] of Object.entries(GOAL_SEMANTIC_KEYS)) {
    if (goalId === "cancel_reason") continue;
    const val = resolveSemanticValue(meta.field, ctx, { patientKey: meta.patientKey });
    if (isFilled(val) && !isFilled(base[meta.field])) {
      base[meta.field] = val;
    }
  }

  for (const [k, v] of Object.entries(input.patient?.custom_fields ?? {})) {
    const key = `custom:${k}`;
    if (!isFilled(base[key]) && isFilled(v)) base[key] = v;
  }

  return base;
}

/** @deprecated prefer resolveSemanticValue from data-resolver */
export function resolveEffectiveValue(
  field: string,
  patient: PatientSlice | null,
  collected: Record<string, unknown>,
  turnFacts: NormalizedFacts & Record<string, unknown>,
  customFieldName?: string
): unknown {
  return resolveSemanticValue(
    field,
    {
      aiState: { consecutive_tool_failures: 0 },
      collected,
      patient: patient
        ? { cpf: patient.cpf, email: patient.email, custom_fields: patient.custom_fields }
        : null,
      turnFacts,
    },
    { customFieldName }
  );
}
