import type { SideEffect, TurnRecord } from "../fsm/side-effects";
import type { ToolGateway } from "../tools/gateway";
import { idempotencyKey } from "../tools/adapters/supabase-adapters";

export class EffectRunner {
  constructor(private readonly tools: ToolGateway) {}

  async run(effects: SideEffect[], turnId: string): Promise<void> {
    for (const effect of effects) {
      if (effect.type === "recordConsent") {
        const result = await this.tools.execute(
          {
            name: "recordConsent",
            args: { patientId: effect.patientId },
            idempotencyKey: idempotencyKey(effect.conversationId, turnId, "recordConsent"),
          },
          {
            clinicId: effect.clinicId,
            conversationId: effect.conversationId,
            phoneNumber: "",
            domain: "system",
            fsmState: "consent.pending",
            turnId,
          }
        );
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
    }
  }
}

export function appendTurnAudit(
  effects: SideEffect[],
  record: TurnRecord
): SideEffect[] {
  return [...effects, { type: "appendAudit", record }];
}

export type AuditWriter = (record: TurnRecord) => Promise<void>;

export async function flushAuditEffects(
  effects: SideEffect[],
  writer: AuditWriter
): Promise<void> {
  for (const effect of effects) {
    if (effect.type === "appendAudit") {
      await writer(effect.record);
    }
  }
}
