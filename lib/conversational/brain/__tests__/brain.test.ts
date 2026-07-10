import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlanFromTemplate } from "../planning/plan-templates";
import { semanticFaqSearch } from "../knowledge/semantic-faq";
import { UnderstandingLayer } from "../understanding/understanding-layer";
import type { TurnContext } from "../types/turn-context";
import { initialOperationalMemory } from "../types/memory";
import { applyReplyGuards } from "../composition/reply-guards";

function mockContext(message: string): TurnContext {
  return {
    conversation: {} as TurnContext["conversation"],
    config: {
      clinicId: "c1",
      assistantName: "Assistente",
      requiresConsentForMessaging: true,
      llmDisabled: false,
      humanHandoffEnabled: true,
      faqs: [],
    },
    message,
    phoneNumber: "5511999999999",
    turnId: "t1",
    history: [],
    operationalMemory: initialOperationalMemory(),
    clinicSummary: {
      clinicName: "Clínica Teste",
      topServices: [{ id: "1", name: "Dermatologia" }],
      hoursText: "Seg-Sex 8h-18h",
      address: "Rua A",
    },
  };
}

describe("brain v2", () => {
  it("plano template lista serviços para 'com o que trabalham'", () => {
    const ctx = mockContext("Com o que vocês trabalham?");
    const plan = buildPlanFromTemplate(ctx, {
      primaryGoal: "inform",
      infoNeeds: ["what_we_do"],
      entities: {},
      missingEntities: [],
      menuReference: null,
      sentiment: "neutral",
      confidence: 0.9,
      rawSummary: "discovery",
    });
    assert.ok(plan);
    assert.equal(plan?.toolSteps[0]?.tool, "listServices");
  });

  it("menu 3 gera clarify", async () => {
    const layer = new UnderstandingLayer();
    const ctx = mockContext("3");
    ctx.operationalMemory.lastMenuShown = {
      options: ["Agendar", "Preços", "Dúvidas", "Contato", "Atendente"],
      at: new Date().toISOString(),
    };
    const u = await layer.analyze(ctx);
    assert.equal(u.menuReference, 3);
    assert.equal(u.primaryGoal, "clarify");
  });

  it("semantic faq encontra por tokens", () => {
    const hit = semanticFaqSearch("horário de funcionamento", [
      { id: "1", question: "Qual o horário?", answer: "Segunda a sexta 8h às 18h" },
    ]);
    assert.ok(hit);
  });

  it("reply guard bloqueia repetição", () => {
    const msg = "Não encontrei essa informação agora.";
    const guarded = applyReplyGuards(msg, [msg], "frustrated");
    assert.ok(!guarded.includes("Não encontrei essa informação agora"));
  });
});
