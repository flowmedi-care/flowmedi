import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideAuthentication,
  getDefaultMfaPolicy,
  mergeMfaPolicy,
} from "../mfa-policy";

describe("MfaPolicy", () => {
  it("optional: no wizard redirect, banner when not enrolled", () => {
    const d = decideAuthentication(getDefaultMfaPolicy(), {
      role: "admin",
      mfaEnrolled: false,
    });
    assert.equal(d.redirectToWizard, false);
    assert.equal(d.challengeMfa, false);
    assert.equal(d.showReminderBanner, true);
  });

  it("optional: challenge when enrolled aal1→aal2", () => {
    const d = decideAuthentication(getDefaultMfaPolicy(), {
      role: "admin",
      mfaEnrolled: true,
      aal: { currentLevel: "aal1", nextLevel: "aal2" },
    });
    assert.equal(d.challengeMfa, true);
    assert.equal(d.redirectToWizard, false);
    assert.equal(d.showReminderBanner, false);
  });

  it("required_for_admins redirects admin without enrollment", () => {
    const policy = mergeMfaPolicy({ mode: "required_for_admins" });
    const d = decideAuthentication(policy, {
      role: "admin",
      mfaEnrolled: false,
    });
    assert.equal(d.redirectToWizard, true);
    assert.equal(d.showReminderBanner, false);
  });

  it("required_for_admins does not redirect secretaria", () => {
    const policy = mergeMfaPolicy({ mode: "required_for_admins" });
    const d = decideAuthentication(policy, {
      role: "secretaria",
      mfaEnrolled: false,
    });
    assert.equal(d.redirectToWizard, false);
    assert.equal(d.showReminderBanner, true);
  });
});
