import type { NormalizedFacts } from "@/lib/chatbot/extractors/types";
import type { AiState } from "@/lib/chatbot/state/types";
import type { GoalDefinition } from "./types";
import type { PatientSlice } from "@/lib/chatbot/snapshot/loaders/patient-loader";

export type GoalResolverContext = {
  aiState: AiState;
  collected: Record<string, unknown>;
  patient?: Record<string, unknown> | null;
  turnFacts?: NormalizedFacts & Record<string, unknown>;
  mutation_done?: Record<string, boolean>;
};

/** Semantic keys mapped for built-in intake goals. */
export const GOAL_SEMANTIC_KEYS: Record<string, { field: string; patientKey?: string }> = {
  cpf: { field: "cpf", patientKey: "cpf" },
  email: { field: "email", patientKey: "email" },
  insurance: { field: "insurance" },
  payment_method: { field: "payment_method" },
  guardian: { field: "guardian" },
  cancel_reason: { field: "cancel_reason" },
};

export function isFilled(val: unknown): boolean {
  return val !== undefined && val !== null && val !== "";
}

export function mergeCollectedSources(aiState: AiState): Record<string, unknown> {
  const flowCollected = aiState.conversation_flow?.collected ?? {};
  const legacy = (aiState as Record<string, unknown>).collected;
  if (legacy && typeof legacy === "object") {
    return { ...(legacy as Record<string, unknown>), ...flowCollected };
  }
  return { ...flowCollected };
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Resolve a semantic field from all sources (order: turnFacts → collected → patient → booking).
 * Goal callers use semantic keys only — not source paths.
 */
export function resolveSemanticValue(
  field: string,
  ctx: GoalResolverContext,
  opts?: { patientKey?: string; customFieldName?: string }
): unknown {
  const turnFacts = ctx.turnFacts ?? {};
  const collected = ctx.collected;
  const patient = ctx.patient;

  if (field === "cpf" && turnFacts.cpf) return turnFacts.cpf;
  if (field === "email" && turnFacts.email) return turnFacts.email;

  if (isFilled(collected[field])) return collected[field];
  if (isFilled(collected[`custom:${field}`])) return collected[`custom:${field}`];

  const patientKey = opts?.patientKey ?? field;
  if (patient && typeof patient === "object") {
    const rec = patient as Record<string, unknown>;
    if (isFilled(rec[patientKey])) return rec[patientKey];
    const custom = rec.custom_fields;
    if (custom && typeof custom === "object") {
      const cVal = (custom as Record<string, unknown>)[opts?.customFieldName ?? field];
      if (isFilled(cVal)) return cVal;
    }
  }

  const bookingVal = getByPath(
    { booking: ctx.aiState.booking ?? {} } as Record<string, unknown>,
    field.startsWith("booking.") ? field : `booking.${field}`
  );
  if (isFilled(bookingVal)) return bookingVal;

  return undefined;
}

export function resolveGoalValue(
  goal: GoalDefinition,
  ctx: GoalResolverContext
): unknown {
  switch (goal.completion.type) {
    case "state_path":
      return getByPath(ctx.aiState as Record<string, unknown>, goal.completion.path);
    case "collected":
    case "patient_or_collected": {
      const key = goal.completion.key;
      const semantic = GOAL_SEMANTIC_KEYS[goal.id];
      if (semantic) {
        return resolveSemanticValue(semantic.field, ctx, {
          patientKey: goal.completion.type === "patient_or_collected"
            ? goal.completion.patientKey ?? semantic.patientKey
            : semantic.patientKey,
        });
      }
      if (key.startsWith("custom:")) {
        const fieldName = key.slice("custom:".length);
        return resolveSemanticValue(fieldName, ctx, { customFieldName: fieldName });
      }
      return resolveSemanticValue(key, ctx);
    }
    case "mutation":
      return ctx.mutation_done?.[goal.completion.key] ? true : undefined;
    default:
      return undefined;
  }
}

export function isGoalValueSatisfied(goal: GoalDefinition, ctx: GoalResolverContext): boolean {
  if (goal.completion.type === "custom") {
    return false;
  }
  if (goal.completion.type === "mutation") {
    return Boolean(ctx.mutation_done?.[goal.completion.key]);
  }
  return isFilled(resolveGoalValue(goal, ctx));
}

export function buildResolverContext(input: {
  aiState: AiState;
  collected: Record<string, unknown>;
  patient?: Record<string, unknown> | null;
  turnFacts?: NormalizedFacts & Record<string, unknown>;
  mutation_done?: Record<string, boolean>;
}): GoalResolverContext {
  return {
    aiState: input.aiState,
    collected: input.collected,
    patient: input.patient,
    turnFacts: input.turnFacts,
    mutation_done: input.mutation_done,
  };
}

export function patientSliceToResolverPatient(
  patient: PatientSlice | null
): Record<string, unknown> | null {
  if (!patient) return null;
  return {
    id: patient.id,
    cpf: patient.cpf,
    email: patient.email,
    age: patient.age,
    custom_fields: patient.custom_fields,
  };
}
