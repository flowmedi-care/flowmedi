import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getExhaustedAction,
  getTimeoutPolicy,
  listTimeoutPolicySteps,
} from "../timeout-policy";

describe("timeout-policy", () => {
  it("includes formulario and nps policies", () => {
    assert.ok(getTimeoutPolicy("formulario_pendente"));
    assert.ok(getTimeoutPolicy("pesquisa_nps_enviada"));
  });

  it("orcamento_enviado transitions pipeline to captacao when exhausted", () => {
    const p = getTimeoutPolicy("orcamento_enviado");
    assert.equal(p?.pipelineTransition, "captacao");
    assert.equal(getExhaustedAction("orcamento_enviado"), "transition_pipeline");
  });

  it("lists policy steps", () => {
    const steps = listTimeoutPolicySteps();
    assert.ok(steps.includes("compliance_2d_enviado"));
    assert.ok(steps.length >= 8);
  });
});
