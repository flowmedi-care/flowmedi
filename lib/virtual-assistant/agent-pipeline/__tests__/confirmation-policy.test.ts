import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDefaultToolExecutionModes,
  mergeToolExecutionModes,
  requiresHumanConfirm,
} from "../confirmation-policy";

describe("confirmation-policy", () => {
  it("defaults cancel_appointment to human_confirm", () => {
    const modes = buildDefaultToolExecutionModes();
    assert.equal(modes.cancel_appointment, "human_confirm");
    assert.equal(requiresHumanConfirm("cancel_appointment", modes), true);
  });

  it("other mutating tools default to auto", () => {
    const modes = buildDefaultToolExecutionModes();
    assert.equal(modes.create_appointment, "auto");
    assert.equal(requiresHumanConfirm("create_appointment", modes), false);
  });

  it("stored config overrides default for cancel", () => {
    const merged = mergeToolExecutionModes({ cancel_appointment: "auto" });
    assert.equal(merged.cancel_appointment, "auto");
    assert.equal(requiresHumanConfirm("cancel_appointment", merged), false);
  });
});
