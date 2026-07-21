import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decidePrivacyNotice,
  getDefaultPrivacyNoticePolicy,
  mergePrivacyNoticePolicy,
} from "../privacy-notice-policy";
import {
  decideConversationStyle,
  mergeConversationStylePolicy,
  toPromptInstructions,
} from "../conversation-style-policy";
import {
  decideHandoff,
  getDefaultHandoffPolicy,
  mergeHandoffPolicy,
} from "../handoff-policy";

describe("PrivacyNoticePolicy", () => {
  it("defaults to disabled and does not send", () => {
    const policy = getDefaultPrivacyNoticePolicy();
    assert.equal(policy.mode, "disabled");
    const d = decidePrivacyNotice(policy, {
      clinicName: "Clínica X",
      alreadySent: false,
    });
    assert.equal(d.send, false);
    if (!d.send) assert.equal(d.reason, "disabled");
  });

  it("sends on first_message when not already sent", () => {
    const policy = mergePrivacyNoticePolicy({ mode: "first_message" });
    const d = decidePrivacyNotice(policy, {
      clinicName: "Clínica X",
      alreadySent: false,
    });
    assert.equal(d.send, true);
    if (d.send) {
      assert.match(d.body, /Clínica X/);
      assert.equal(d.reason, "first_message");
    }
  });
});

describe("ConversationStylePolicy", () => {
  it("returns instructions without side effects", () => {
    const policy = mergeConversationStylePolicy({ tone: "informal" });
    const d = decideConversationStyle(policy);
    assert.ok(d.instructions.includes("Estilo de resposta"));
    assert.ok(toPromptInstructions(d).length > 0);
    assert.equal(d.maxQuestions, 1);
  });
});

describe("HandoffPolicy", () => {
  it("transfers on explicit request inside hours", () => {
    const d = decideHandoff(getDefaultHandoffPolicy(), {
      trigger: "explicit_request",
      insideHours: true,
      explicitHumanRequest: true,
    });
    assert.equal(d.action, "transfer");
    if (d.action === "transfer") {
      assert.equal(d.kind, "temporary");
      assert.equal(d.ownership, "assign_routing");
      assert.ok(d.patientReply.length > 0);
    }
  });

  it("stays with AI outside hours", () => {
    const d = decideHandoff(mergeHandoffPolicy({}), {
      trigger: "explicit_request",
      insideHours: false,
      explicitHumanRequest: true,
    });
    assert.equal(d.action, "stay_with_ai");
    if (d.action === "stay_with_ai") {
      assert.equal(d.reason, "outside_handoff_hours");
      assert.ok(d.patientReply);
    }
  });

  it("opt-out uses unassigned ownership", () => {
    const d = decideHandoff(getDefaultHandoffPolicy(), {
      trigger: "user_opt_out",
      insideHours: false,
      explicitHumanRequest: true,
    });
    assert.equal(d.action, "transfer");
    if (d.action === "transfer") {
      assert.equal(d.kind, "opt_out");
      assert.equal(d.ownership, "unassigned");
    }
  });
});
