import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeIntakeGap, hydrateCollectedFromSnapshot } from "../gap-resolver";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import { DEFAULT_APPOINTMENT_POLICY } from "@/lib/attendance-flow/defaults";
import type { AiState } from "@/lib/chatbot/state/types";

describe("gap-resolver", () => {
  const patient = {
    id: "p-1",
    full_name: "Daniel Ranna",
    display_name: "Daniel",
    email: null,
    cpf: "05126248103",
    phone: "5562996915034",
    birth_date: null,
    age: null,
    custom_fields: {},
  };

  it("excludes cpf from gap when patient has cpf", () => {
    const aiState: AiState = { consecutive_tool_failures: 0 };
    const gap = computeIntakeGap({
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      patient,
      aiState,
      turnFacts: {},
      customFields: [],
    });
    assert.ok(!gap.some((g) => g.goal_id === "cpf"));
  });

  it("excludes email from gap when collected in turnFacts", () => {
    const aiState: AiState = { consecutive_tool_failures: 0 };
    const gap = computeIntakeGap({
      policy: DEFAULT_APPOINTMENT_POLICY,
      registry: defaultGoalRegistry,
      patient,
      aiState,
      turnFacts: { email: "test@example.com" },
      customFields: [],
    });
    assert.ok(!gap.some((g) => g.goal_id === "email"));
  });

  it("hydrates collected from patient cpf", () => {
    const collected = hydrateCollectedFromSnapshot({
      patient,
      aiState: { consecutive_tool_failures: 0 },
      turnFacts: {},
    });
    assert.equal(collected.cpf, "05126248103");
  });
});
