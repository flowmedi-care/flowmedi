import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Perception } from "../perception/perception";
import { Reasoner } from "../reasoning/reasoner";
import { semanticFaqSearch } from "../knowledge/semantic-faq";
import { initialOperationalMemory } from "../types/memory";
import { applyReplyGuards } from "../composition/reply-guards";

const clinicSummary = {
  clinicName: "Clínica Teste",
  topServices: [{ id: "1", name: "Dermatologia" }],
  hoursText: "Seg-Sex 8h-18h",
  address: "Rua A",
};

describe("brain v2 P8 utilities", () => {
  it("discovery escolhe listServices ou searchFaq", () => {
    const reasoner = new Reasoner();
    const perceived = new Perception().extract(
      "Com o que vocês trabalham?",
      clinicSummary,
      initialOperationalMemory()
    );
    const result = reasoner.think({ perceived, memory: initialOperationalMemory() });
    assert.equal(result.goal.type, "inform");
    assert.ok(
      result.chosenAction.id === "tool.listServices" ||
        result.chosenAction.id === "tool.searchFaq" ||
        result.chosenAction.kind === "ask",
      `esperava tool de discovery ou ask, obteve ${result.chosenAction.id}`
    );
  });

  it("menu 3 gera goal inform/clarify", () => {
    const memory = initialOperationalMemory();
    memory.lastMenuShown = {
      options: ["Agendar", "Preços", "Dúvidas", "Contato", "Atendente"],
      at: new Date().toISOString(),
    };
    const perceived = new Perception().extract("3", clinicSummary, memory);
    const result = new Reasoner().think({ perceived, memory });
    assert.equal(perceived.menuChoice, 3);
    assert.ok(result.goal.type === "clarify" || result.goal.type === "inform" || result.chosenAction.kind === "ask");
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
