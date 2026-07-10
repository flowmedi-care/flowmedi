import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlanFromTemplate } from "../planning/plan-templates";
import { UnderstandingLayer } from "../understanding/understanding-layer";
import { groupToolStepsIntoWaves } from "../execution/tool-planner";
import type { TurnContext } from "../types/turn-context";
import { initialOperationalMemory } from "../types/memory";

function mockContext(message: string): TurnContext {
  return {
    conversation: { clinicId: "pilot-clinic" } as TurnContext["conversation"],
    config: {
      clinicId: "pilot-clinic",
      assistantName: "Assistente",
      requiresConsentForMessaging: true,
      llmDisabled: false,
      humanHandoffEnabled: true,
      faqs: [
        {
          id: "f1",
          question: "Horário de funcionamento",
          answer: "Segunda a sexta, 8h às 18h",
        },
      ],
    },
    message,
    phoneNumber: "5511999999999",
    turnId: "t-eval",
    history: [],
    operationalMemory: initialOperationalMemory(),
    clinicSummary: {
      clinicName: "Clínica Piloto",
      topServices: [
        { id: "1", name: "Dermatologia" },
        { id: "2", name: "Estética" },
      ],
      hoursText: "Seg-Sex 8h-18h",
      address: "Av. Paulista, 1000",
    },
  };
}

type GoldenCase = {
  name: string;
  message: string;
  expectGoal?: string;
  expectTool?: string;
  expectClarify?: boolean;
  menuRef?: number;
};

const GOLDEN: GoldenCase[] = [
  { name: "discovery com o que trabalham", message: "Com o que vocês trabalham?", expectGoal: "inform", expectTool: "listServices" },
  { name: "discovery especialidades", message: "Quais especialidades vocês têm?", expectGoal: "inform", expectTool: "listServices" },
  { name: "discovery procedimentos", message: "Que procedimentos vocês fazem?", expectGoal: "inform", expectTool: "listServices" },
  { name: "preço direto", message: "Quanto custa a consulta de dermatologia?", expectGoal: "price", expectTool: "listServices" },
  { name: "preço valor", message: "Qual o valor do botox?", expectGoal: "price", expectTool: "listServices" },
  { name: "agenda vaga", message: "Tem vaga para amanhã?", expectGoal: "book", expectTool: "listServices" },
  { name: "agenda horário", message: "Quero marcar consulta", expectGoal: "book", expectTool: "listServices" },
  { name: "saudação oi", message: "Oi", expectGoal: "greet" },
  { name: "saudação bom dia", message: "Bom dia!", expectGoal: "greet" },
  { name: "menu opção 3", message: "3", expectGoal: "clarify", expectClarify: true, menuRef: 3 },
  { name: "menu opção 2 preços", message: "2", expectGoal: "price", menuRef: 2 },
  { name: "handoff atendente", message: "Quero falar com atendente", expectGoal: "handoff" },
  { name: "handoff humano", message: "Me passa para uma pessoa", expectGoal: "handoff" },
  { name: "faq horário", message: "Qual o horário de funcionamento?", expectGoal: "inform", expectTool: "searchFaq" },
  { name: "faq endereço", message: "Onde fica a clínica?", expectGoal: "inform", expectTool: "searchFaq" },
  { name: "negação atendente", message: "Não quero atendente", expectGoal: "inform" },
  { name: "agradecimento", message: "Obrigado!", expectGoal: "greet" },
  { name: "preço genérico", message: "Quanto custa?", expectGoal: "price", expectTool: "listServices" },
  { name: "serviço específico", message: "Vocês fazem peeling?", expectGoal: "inform", expectTool: "listServices" },
  { name: "dúvida aberta", message: "Tenho uma dúvida", expectGoal: "clarify", expectClarify: true },
];

describe("conversation eval — 20 golden cases", () => {
  for (const c of GOLDEN) {
    it(c.name, async () => {
      const ctx = mockContext(c.message);
      if (c.menuRef) {
        ctx.operationalMemory.lastMenuShown = {
          options: ["Agendar", "Preços", "Dúvidas", "Contato", "Atendente"],
          at: new Date().toISOString(),
        };
      }

      const layer = new UnderstandingLayer();
      const understanding = await layer.analyze(ctx);
      const plan = buildPlanFromTemplate(ctx, understanding);

      if (c.expectGoal) {
        assert.equal(
          understanding.primaryGoal,
          c.expectGoal,
          `goal esperado ${c.expectGoal}, obteve ${understanding.primaryGoal}`
        );
      }

      if (c.expectTool) {
        assert.ok(plan, "plano deveria existir");
        assert.equal(
          plan?.toolSteps[0]?.tool,
          c.expectTool,
          `tool esperada ${c.expectTool}`
        );
      }

      if (c.expectClarify) {
        assert.ok(plan?.clarify, "deveria pedir clarificação");
      }

      if (c.menuRef) {
        assert.equal(understanding.menuReference, c.menuRef);
      }
    });
  }
});

describe("tool planner waves", () => {
  it("executa steps independentes na mesma onda", () => {
    const waves = groupToolStepsIntoWaves([
      { id: "a", tool: "listServices", args: {}, parallelizable: true },
      { id: "b", tool: "searchFaq", args: {}, parallelizable: true },
      {
        id: "c",
        tool: "getPriceQuote",
        args: {},
        dependsOn: ["a"],
        parallelizable: false,
      },
    ]);
    assert.equal(waves.length, 2);
    assert.equal(waves[0].length, 2);
    assert.equal(waves[1][0].id, "c");
  });
});
