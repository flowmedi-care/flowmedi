import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStageHistoryFromEvents,
  deriveVisitedStages,
  mapHistoryToCrmEdgeIds,
} from "../../conversation-pipeline-state";
import { getPipelineConfigJson } from "../pipeline-config";
import { AGENT_PIPELINE_STAGES } from "../stages";
import { CRM_TRANSITION_COUNT } from "../flow-model";

describe("conversation-pipeline-state", () => {
  it("builds stage history from pipeline_stage_enter events", () => {
    const history = buildStageHistoryFromEvents([
      {
        created_at: "2026-01-01T10:00:00Z",
        detail: { from_stage: "identificacao", to_stage: "captacao", trigger: "initial" },
      },
      {
        created_at: "2026-01-01T10:05:00Z",
        detail: { from_stage: "captacao", to_stage: "agendamento", trigger: "intent" },
      },
    ]);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.stage, "captacao");
    assert.equal(history[1]?.fromStage, "captacao");
    assert.equal(history[1]?.stage, "agendamento");
  });

  it("derives visited stages in order without duplicates", () => {
    const history = buildStageHistoryFromEvents([
      {
        created_at: "2026-01-01T10:00:00Z",
        detail: { to_stage: "captacao" },
      },
      {
        created_at: "2026-01-01T10:05:00Z",
        detail: { from_stage: "captacao", to_stage: "agendamento" },
      },
      {
        created_at: "2026-01-01T10:10:00Z",
        detail: { from_stage: "agendamento", to_stage: "captacao" },
      },
    ]);
    const visited = deriveVisitedStages(history, "agendamento");
    assert.deepEqual(visited, ["captacao", "agendamento"]);
  });

  it("maps history transitions to CRM edge ids", () => {
    const ids = mapHistoryToCrmEdgeIds([
      { stage: "captacao", enteredAt: "2026-01-01", fromStage: "identificacao" },
      { stage: "agendamento", enteredAt: "2026-01-02", fromStage: "captacao" },
    ]);
    assert.ok(ids.length >= 1);
    assert.ok(ids.every((id) => id.startsWith("crm-")));
  });
});

describe("pipeline-config", () => {
  it("exports JSON config for all main stages", () => {
    const config = getPipelineConfigJson();
    assert.equal(config.length, AGENT_PIPELINE_STAGES.length);
    const captacao = config.find((s) => s.id === "captacao");
    assert.ok(captacao);
    assert.ok(captacao.ferramentas_permitidas.length > 0);
    assert.ok(captacao.pre_condicoes.length > 0);
    assert.ok(captacao.transicoes.length > 0);
  });

  it("transitions count matches CRM model", () => {
    const config = getPipelineConfigJson();
    const totalTransitions = config.reduce((n, s) => n + s.transicoes.length, 0);
    assert.equal(totalTransitions, CRM_TRANSITION_COUNT);
  });
});
