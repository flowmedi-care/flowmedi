import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_PIPELINE_FLOW_EDGES, AGENT_PIPELINE_FLOW_NODES } from "../flow-graph";
import {
  CRM_TRANSITION_COUNT,
  EXECUTION_NODE_COUNT,
  EXIT_RULE_COUNT,
  PARALLEL_RULE_COUNT,
  RESOLVER_SWITCH_OUTPUT_COUNT,
} from "../flow-model";
import { buildUnifiedGraph, validateUnifiedGraphIntegrity } from "../unified-flow-graph";
import { filterGraphForView, getJourneyVisibleStageIds } from "../view-filter";

describe("flow-model counts", () => {
  it("has expected execution nodes and switch rules", () => {
    assert.equal(EXECUTION_NODE_COUNT, 16);
    assert.equal(RESOLVER_SWITCH_OUTPUT_COUNT, 9);
    assert.equal(CRM_TRANSITION_COUNT, 17);
    assert.equal(PARALLEL_RULE_COUNT, 2);
    assert.equal(EXIT_RULE_COUNT, 6);
  });
});

describe("unified-flow-graph integrity", () => {
  it("includes all CRM main/parallel edges from flow-graph", () => {
    const graph = buildUnifiedGraph({
      activeStage: "agendamento",
      expandedStages: new Set(["agendamento"]),
    });
    const result = validateUnifiedGraphIntegrity(graph);
    assert.equal(result.ok, true, result.errors.join("\n"));
  });

  it("has execution nodes including switch and new runtime nodes", () => {
    const graph = buildUnifiedGraph({ activeStage: "captacao" });
    assert.ok(graph.nodes.some((n) => n.id === "runtime_detect_intent"));
    assert.ok(graph.nodes.some((n) => n.id === "runtime_escalate_gate"));
    assert.ok(graph.nodes.some((n) => n.id === "runtime_execute_tool"));
    assert.ok(graph.nodes.some((n) => n.id === "runtime_handoff"));
    assert.ok(graph.nodes.some((n) => n.id === "runtime_end"));
    assert.ok(graph.nodes.some((n) => n.id === "runtime_resolver_switch"));
  });

  it("has 17 CRM transitions plus escalation bus", () => {
    const graph = buildUnifiedGraph({ activeStage: "captacao" });
    const crm = graph.edges.filter((e) => e.kind === "stage_transition" || e.kind === "parallel");
    const expected = AGENT_PIPELINE_FLOW_EDGES.filter((e) => e.kind !== "transversal");
    assert.equal(crm.length, expected.length);

    const toBus = graph.edges.filter(
      (e) => e.kind === "transversal" && e.to === "anchor_escalation_bus" && e.from.startsWith("stage_")
    );
    assert.equal(toBus.length, 7);
  });

  it("creates dynamic switch edges when activeStage set", () => {
    const graph = buildUnifiedGraph({ activeStage: "agendamento" });
    assert.ok(graph.edges.some((e) => e.id === "dyn-switch-stage"));
    assert.ok(graph.edges.some((e) => e.id === "dyn-stage-tools"));
  });

  it("references only existing nodes", () => {
    const graph = buildUnifiedGraph({
      activeStage: "confirmacao_pre_consulta",
      parallelStages: ["formularios"],
      expandedStages: new Set(["confirmacao_pre_consulta"]),
    });
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const e of graph.edges) {
      if (e.to.startsWith("tool_") && !ids.has(e.to)) continue;
      if (e.from.startsWith("tool_") && !ids.has(e.from)) continue;
      assert.ok(ids.has(e.from), `missing ${e.from} for ${e.id}`);
      assert.ok(ids.has(e.to), `missing ${e.to} for ${e.id}`);
    }
  });

  it("has 5 swimlane backgrounds", () => {
    const graph = buildUnifiedGraph({});
    const lanes = graph.nodes.filter((n) => n.kind === "swimlane");
    assert.equal(lanes.length, 5);
  });
});

describe("view-filter", () => {
  it("journey full view includes all 10 stage nodes", () => {
    const graph = buildUnifiedGraph({ activeStage: "agendamento" });
    const filtered = filterGraphForView(graph.nodes, graph.edges, {
      tab: "journey",
      journeyMode: "full",
      activeStage: "agendamento",
    });
    const stages = filtered.nodes.filter((n) => n.kind === "stage");
    assert.equal(stages.length, AGENT_PIPELINE_FLOW_NODES.length);
  });

  it("journey active view filters to neighbors of active stage", () => {
    const visible = getJourneyVisibleStageIds("active", "agendamento", []);
    assert.ok(visible.has("agendamento"));
    assert.ok(visible.has("confirmacao_pre_consulta"));
    assert.ok(visible.has("orcamento"));
    assert.ok(visible.has("captacao"));
    assert.ok(visible.has("financeiro"));
    assert.ok(visible.has("formularios"));
    assert.ok(!visible.has("satisfacao"));
  });

  it("journey view hides escalation bus edges", () => {
    const graph = buildUnifiedGraph({ activeStage: "agendamento" });
    const filtered = filterGraphForView(graph.nodes, graph.edges, {
      tab: "journey",
      journeyMode: "full",
      activeStage: "agendamento",
    });
    const transversal = filtered.edges.filter((e) => e.kind === "transversal");
    assert.equal(transversal.length, 0);
  });

  it("execution view hides CRM stage nodes", () => {
    const graph = buildUnifiedGraph({ activeStage: "agendamento" });
    const filtered = filterGraphForView(graph.nodes, graph.edges, {
      tab: "execution",
      activeStage: "agendamento",
    });
    assert.equal(
      filtered.nodes.filter((n) => n.kind === "stage").length,
      0
    );
    assert.ok(filtered.nodes.some((n) => n.id === "runtime_resolver_switch"));
  });

  it("exits view shows escalonamento without main CRM stages", () => {
    const graph = buildUnifiedGraph({});
    const filtered = filterGraphForView(graph.nodes, graph.edges, { tab: "exits" });
    const stages = filtered.nodes.filter((n) => n.kind === "stage");
    assert.equal(stages.length, 1);
    assert.equal(stages[0]?.stageCode, "escalonamento");
    assert.ok(filtered.nodes.some((n) => n.id === "runtime_handoff"));
  });
});
