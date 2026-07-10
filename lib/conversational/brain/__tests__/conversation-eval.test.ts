import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Perception } from "../perception/perception";
import { Reasoner } from "../reasoning/reasoner";
import { initialOperationalMemory } from "../types/memory";
import type { OperationalMemory } from "../types/memory";

const clinicSummary = {
  clinicName: "Clínica Piloto",
  topServices: [
    { id: "1", name: "Dermatologia" },
    { id: "2", name: "Estética" },
  ],
  hoursText: "Seg-Sex 8h-18h",
  address: "Av. Paulista, 1000",
};

type GoldenCase = {
  name: string;
  message: string;
  expectGoal?: string;
  expectTool?: string;
  expectAsk?: boolean;
  menuRef?: number;
};

const GOAL_MAP: Record<string, string[]> = {
  book: ["booking"],
  greet: ["chat"],
  price: ["price"],
  handoff: ["handoff"],
  inform: ["inform", "faq"],
  clarify: ["clarify", "inform"],
  faq: ["faq", "inform"],
};

const GOLDEN: GoldenCase[] = [
  { name: "discovery com o que trabalham", message: "Com o que vocês trabalham?", expectGoal: "inform", expectTool: "listServices" },
  { name: "discovery especialidades", message: "Quais especialidades vocês têm?", expectGoal: "inform", expectTool: "listServices" },
  { name: "discovery procedimentos", message: "Que procedimentos vocês fazem?", expectGoal: "inform", expectTool: "listServices" },
  { name: "preço direto", message: "Quanto custa a consulta de dermatologia?", expectGoal: "price" },
  { name: "preço valor", message: "Qual o valor do botox?", expectGoal: "price" },
  { name: "agenda vaga", message: "Tem vaga para amanhã?", expectGoal: "book" },
  { name: "agenda horário", message: "Quero marcar consulta", expectGoal: "book" },
  { name: "saudação oi", message: "Oi", expectGoal: "greet", expectAsk: true },
  { name: "saudação bom dia", message: "Bom dia!", expectGoal: "greet", expectAsk: true },
  { name: "menu opção 3", message: "3", expectGoal: "clarify", menuRef: 3 },
  { name: "menu opção 2 preços", message: "2", expectGoal: "price", menuRef: 2 },
  { name: "handoff atendente", message: "Quero falar com atendente", expectGoal: "handoff", expectTool: "openHandoffTicket" },
  { name: "handoff humano", message: "Me passa para uma pessoa", expectGoal: "handoff", expectTool: "openHandoffTicket" },
  { name: "faq horário", message: "Qual o horário de funcionamento?", expectGoal: "inform", expectTool: "searchFaq" },
  { name: "faq endereço", message: "Onde fica a clínica?", expectGoal: "inform", expectTool: "searchFaq" },
  { name: "agradecimento", message: "Obrigado!", expectGoal: "greet", expectAsk: true },
  { name: "preço genérico", message: "Quanto custa?", expectGoal: "price" },
  { name: "serviço específico", message: "Vocês fazem peeling?", expectGoal: "inform", expectTool: "listServices" },
];

function runTurn(message: string, memory: OperationalMemory = initialOperationalMemory()) {
  const perceived = new Perception().extract(message, clinicSummary, memory);
  const result = new Reasoner().think({ perceived, memory });
  return { perceived, result };
}

describe("conversation eval — P8 golden cases", () => {
  for (const c of GOLDEN) {
    it(c.name, () => {
      const memory = initialOperationalMemory();
      if (c.menuRef) {
        memory.lastMenuShown = {
          options: ["Agendar", "Preços", "Dúvidas", "Contato", "Atendente"],
          at: new Date().toISOString(),
        };
      }

      const { perceived, result } = runTurn(c.message, memory);

      if (c.expectGoal) {
        const expectedTypes = GOAL_MAP[c.expectGoal] ?? [c.expectGoal];
        assert.ok(
          expectedTypes.includes(result.goal.type),
          `goal esperado ${expectedTypes.join("|")}, obteve ${result.goal.type}`
        );
      }

      if (c.expectTool) {
        assert.equal(result.decision.type, "TOOL", "decisão deveria ser TOOL");
        if ("tool" in result.chosenAction.payload) {
          const tool = result.chosenAction.payload.tool;
          if (c.expectTool === "listServices") {
            assert.ok(
              tool === "listServices" || tool === "searchFaq",
              `tool esperada listServices ou searchFaq, obteve ${tool}`
            );
          } else {
            assert.equal(tool, c.expectTool, `tool esperada ${c.expectTool}`);
          }
        }
      }

      if (c.expectAsk) {
        assert.equal(result.decision.type, "ASK", "decisão deveria ser ASK");
      }

      if (c.menuRef) {
        assert.equal(perceived.menuChoice, c.menuRef);
      }
    });
  }
});

describe("action providers sem gaps", () => {
  it("AskActionProvider não recebe gaps", () => {
    const { result } = runTurn("Quero agendar endoscopia");
    assert.ok(result.candidates.length > 0);
    assert.ok(result.candidates.every((c) => c.score > -Infinity));
  });
});
