import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDefaultConfidence,
  getDefaultConversationRecoveryPolicy,
  patientReasonForToolFailure,
  recordConversationSuccess,
  recoverConversation,
  shouldRewriteWithRecovery,
} from "../conversation-recovery-policy";
import { ANTI_INVENT_MATRIX, buildAntiInventPromptBlock } from "../anti-invent-matrix";

describe("ConversationRecovery", () => {
  it("never echoes generic unavailable alone", () => {
    assert.equal(
      shouldRewriteWithRecovery(
        "Esta informação não está disponível pelo assistente no momento."
      ),
      true
    );
    const d = recoverConversation(getDefaultConversationRecoveryPolicy(), {
      reason: "day_selected",
      patientFacingReason: patientReasonForToolFailure({
        toolName: "find_available_slots",
        deterministicReason: "day_selected",
      }),
      retry: true,
      confidence: getDefaultConfidence(),
    });
    assert.equal(d.nextConfidence.level, "low");
    assert.ok(!/não está disponível pelo assistente/i.test(d.patientReply));
    assert.match(d.patientReply, /horários|tentar/i);
  });

  it("moves to handoff after two failures", () => {
    const policy = getDefaultConversationRecoveryPolicy();
    const first = recoverConversation(policy, {
      reason: "fail1",
      patientFacingReason: "Não consegui localizar os horários dessa seleção.",
      retry: true,
      confidence: getDefaultConfidence(),
    });
    assert.equal(first.nextConfidence.level, "low");
    const second = recoverConversation(policy, {
      reason: "fail2",
      patientFacingReason: "Não consegui localizar os horários dessa seleção.",
      retry: true,
      confidence: first.nextConfidence,
    });
    assert.equal(second.nextConfidence.level, "handoff");
    assert.equal(second.offerHandoff, true);
    assert.match(second.patientReply, /atendente/i);
  });

  it("success resets toward high", () => {
    const next = recordConversationSuccess({
      level: "low",
      consecutive_failures: 1,
    });
    assert.equal(next.level, "high");
    assert.equal(next.consecutive_failures, 0);
  });
});

describe("AntiInventMatrix", () => {
  it("forbids inventing price and clinic rules", () => {
    const price = ANTI_INVENT_MATRIX.find((r) => r.topic === "Preço");
    assert.ok(price);
    assert.equal(price!.canInvent, false);
    assert.equal(price!.canInfer, false);
    assert.equal(price!.canAsk, true);
    const block = buildAntiInventPromptBlock();
    assert.match(block, /Nunca invente/);
    assert.match(block, /WhatsApp/);
  });
});
