import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_PIPELINE_FLOW_EDGES } from "../flow-graph";
import {
  buildUnifiedGraph,
  validateUnifiedGraphIntegrity,
} from "../unified-flow-graph";

describe("unified-flow-graph integrity", () => {
  it("includes all CRM main/parallel edges from flow-graph", () => {
    const graph = buildUnifiedGraph({
      activeStage: "agendamento",
      expandedStages: new Set(["agendamento"]),
    });
    const result = validateUnifiedGraphIntegrity(graph);
    assert.equal(result.ok, true, result.errors.join("\n"));
  });

  it("has 17 CRM transitions plus 7 main stages to escalation bus", () => {
    const graph = buildUnifiedGraph({ activeStage: "captacao" });
    const crm = graph.edges.filter(
      (e) => e.kind === "stage_transition" || e.kind === "parallel"
    );
    const expected = AGENT_PIPELINE_FLOW_EDGES.filter((e) => e.kind !== "transversal");
    assert.equal(crm.length, expected.length);

    const toBus = graph.edges.filter(
      (e) => e.kind === "transversal" && e.to === "anchor_escalation_bus"
    );
    assert.equal(toBus.length, 9); // 7 main + agent + response
  });

  it("creates dynamic resolver and stage-to-tools edges when activeStage set", () => {
    const graph = buildUnifiedGraph({ activeStage: "agendamento" });
    assert.ok(graph.edges.some((e) => e.id === "dyn-resolver-stage"));
    assert.ok(graph.edges.some((e) => e.id === "dyn-stage-tools"));
    assert.equal(
      graph.edges.find((e) => e.id === "dyn-resolver-stage")?.to,
      "stage_agendamento"
    );
  });

  it("references only existing nodes", () => {
    const graph = buildUnifiedGraph({
      activeStage: "confirmacao_pre_consulta",
      parallelStages: ["formularios"],
      expandedStages: new Set(["confirmacao_pre_consulta", "formularios"]),
    });
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const e of graph.edges) {
      assert.ok(ids.has(e.from), `missing node ${e.from} for edge ${e.id}`);
      assert.ok(ids.has(e.to), `missing node ${e.to} for edge ${e.id}`);
    }
  });
});
