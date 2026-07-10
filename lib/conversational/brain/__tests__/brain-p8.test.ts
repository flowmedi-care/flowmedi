import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Perception } from "../perception/perception";
import { Reasoner } from "../reasoning/reasoner";
import { buildDomainGraph } from "../graph/graphs/booking.graph";
import { initialOperationalMemory } from "../types/memory";
import { WeightedPathHeuristic } from "../planning/remaining-cost";
import { scoreAction } from "../planning/score-action";
import { allActions } from "../policies/booking-policy";
import { buildStateGraph } from "../policies/domain-policy";
import { unsatisfiedNodes } from "../graph/traversal";

const clinicSummary = {
  clinicName: "Clínica Piloto",
  topServices: [
    { id: "1", name: "Endoscopia" },
    { id: "2", name: "Dermatologia" },
  ],
  hoursText: "Seg-Sex 8h-18h",
  address: "Av. Paulista",
};

describe("brain v2 P8", () => {
  it("perception extrai endoscopia sem inferir ação", () => {
    const p = new Perception();
    const facts = p.extract(
      "Quero agendar uma endoscopia",
      clinicSummary,
      initialOperationalMemory()
    );
    assert.equal(facts.procedureName, "Endoscopia");
    assert.equal(facts.scheduleSignal, true);
  });

  it("booking endoscopia prefere perguntar data em vez de listar serviços", () => {
    const perception = new Perception();
    const reasoner = new Reasoner();
    const perceived = perception.extract(
      "Quero agendar uma endoscopia",
      clinicSummary,
      initialOperationalMemory()
    );
    const result = reasoner.think({ perceived, memory: initialOperationalMemory() });
    assert.equal(result.goal.type, "booking");
    assert.equal(result.goal.desiredNode, "appointment.created");
    assert.ok(
      result.chosenAction.id === "ask.date" || result.chosenAction.id === "ask.procedure",
      `esperava ask sobre gap, obteve ${result.chosenAction.id}`
    );
    assert.notEqual(result.chosenAction.id, "tool.listServices");
  });

  it("remainingCost usa pesos do grafo", () => {
    const domain = buildDomainGraph();
    const perception = new Perception();
    const perceived = perception.extract(
      "Quero agendar endoscopia",
      clinicSummary,
      initialOperationalMemory()
    );
    const state = buildStateGraph(perceived, initialOperationalMemory(), domain);
    const heuristic = new WeightedPathHeuristic();
    const cost = heuristic.remainingCost(
      { id: "g1", type: "booking", desiredNode: "appointment.created" },
      domain,
      state
    );
    assert.ok(cost > 0);
  });

  it("createAppointment filtrado sem slot known", () => {
    const domain = buildDomainGraph();
    const perception = new Perception();
    const perceived = perception.extract(
      "Quero agendar endoscopia",
      clinicSummary,
      initialOperationalMemory()
    );
    const state = buildStateGraph(perceived, initialOperationalMemory(), domain);
    const goal = { id: "g1", type: "booking", desiredNode: "appointment.created" };
    const createAction = allActions().find((a) => a.id === "tool.createAppointment");
    assert.ok(createAction);
    const scored = scoreAction(createAction!, goal, domain, state, new WeightedPathHeuristic());
    assert.equal(scored, null);
  });

  it("traverseGaps encontra nós não satisfeitos", () => {
    const domain = buildDomainGraph();
    const perception = new Perception();
    const perceived = perception.extract(
      "Quero agendar endoscopia",
      clinicSummary,
      initialOperationalMemory()
    );
    const state = buildStateGraph(perceived, initialOperationalMemory(), domain);
    const gaps = unsatisfiedNodes(domain, "appointment.created", state);
    assert.ok(gaps.includes("date") || gaps.includes("slot") || gaps.includes("patient"));
  });

  it("saudação escolhe greet sem tool", () => {
    const reasoner = new Reasoner();
    const perceived = new Perception().extract(
      "Oi",
      clinicSummary,
      initialOperationalMemory()
    );
    const result = reasoner.think({ perceived, memory: initialOperationalMemory() });
    assert.equal(result.chosenAction.id, "ask.greet");
    assert.notEqual(result.decision.type, "TOOL");
  });
});
