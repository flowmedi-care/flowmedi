import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyReplyGuards } from "../../guardrails/reply-guards";
import { initialAiState } from "../../state/types";
import { whenLabelFromOffered } from "../../tools/render-structured";
import { extractFacts } from "../../extractors";
import { applySemanticFacts } from "../../state/resolve-facts";

describe("slot selection contract guards", () => {
  const offered = [
    { scheduled_at: "2026-07-17T15:00:00.000Z", display: "12:00" },
    { scheduled_at: "2026-07-17T16:00:00.000Z", display: "13:00" },
    { scheduled_at: "2026-07-17T17:00:00.000Z", display: "14:00" },
  ];

  it("reply-guard blocks 'Você escolheu' without pending_slot and relists", () => {
    const state = {
      ...initialAiState(),
      booking: {
        status: "collecting" as const,
        offered_slots: offered,
      },
    };
    const out = applyReplyGuards(
      "Você escolheu o horário 16:00 (4 da tarde) para a sua consulta.\n\nConfirma que deseja remarcar?",
      state
    );
    assert.match(out, /Horários disponíveis|12:00/);
    assert.doesNotMatch(out, /Você escolheu o horário 16:00/);
  });

  it("reply-guard allows claim when pending_slot exists", () => {
    const state = {
      ...initialAiState(),
      booking: {
        status: "confirming" as const,
        pending_slot: offered[1]!.scheduled_at,
        offered_slots: offered,
      },
    };
    const msg =
      "Você escolheu o horário 13:00 para a sua consulta.\n\nConfirma que deseja remarcar?";
    assert.equal(applyReplyGuards(msg, state), msg);
  });

  it("whenLabelFromOffered prefers display over ISO local skew", () => {
    // 16:00Z → 13:00 in America/Sao_Paulo; display stays authoritative.
    const label = whenLabelFromOffered("2026-07-17T16:00:00.000Z", [
      { scheduled_at: "2026-07-17T16:00:00.000Z", display: "16:00" },
    ]);
    assert.match(label, /16:00/);
    assert.doesNotMatch(label, /13:00/);
  });

  it("facts + semantic: matched 16:00 sets pending_slot", () => {
    const with16 = [
      ...offered,
      { scheduled_at: "2026-07-17T19:00:00.000Z", display: "16:00" },
    ];
    const facts = extractFacts("pode ser as 4 da tarde", new Date(), with16);
    assert.equal(facts.selected_scheduled_at, "2026-07-17T19:00:00.000Z");
    const patch = applySemanticFacts(facts, {
      ...initialAiState(),
      booking: { status: "collecting", offered_slots: with16 },
    });
    assert.equal(patch.booking?.pending_slot, "2026-07-17T19:00:00.000Z");
  });

  it("unmatched 4 da tarde does not set pending_slot", () => {
    const facts = extractFacts("pode ser as 4 da tarde", new Date(), offered);
    assert.equal(facts.time_unmatched, true);
    const patch = applySemanticFacts(facts, {
      ...initialAiState(),
      booking: { status: "collecting", offered_slots: offered },
    });
    assert.equal(patch.booking?.pending_slot, undefined);
  });
});
