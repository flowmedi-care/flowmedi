import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_PIPELINE_FLOW_EDGES } from "../flow-graph";
import {
  CRM_TRANSITION_COUNT,
  EXECUTION_NODE_COUNT,
  EXIT_RULE_COUNT,
  PARALLEL_RULE_COUNT,
  RESOLVER_SWITCH_OUTPUT_COUNT,
} from "../flow-model";
import { buildUnifiedGraph, validateUnifiedGraphIntegrity } from "../unified-flow-graph";

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

    const toBus = graph.edges.filter((e) => e.kind === "transversal" && e.to === "anchor_escalation_bus");
    assert.equal(toBus.length, 9);
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
