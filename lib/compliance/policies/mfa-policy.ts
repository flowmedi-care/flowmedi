/**
 * MfaPolicy — Authentication Decision Engine for TOTP MFA.
 * No side effects: decideAuthentication returns AuthenticationDecision.
 * Consumers (middleware, sign-in, banner) only apply the decision.
 */

export type MfaMode =
  | "optional"
  | "required_for_admins"
  | "required_for_all"
  | "custom";

export type MfaPolicy = {
  mode: MfaMode;
  /** Used when mode === "custom" */
  customRoles?: string[];
  showReminderBanner: boolean;
};

export type MfaPolicyInput = Partial<MfaPolicy>;

export type AuthenticationDecision = {
  challengeMfa: boolean;
  redirectToWizard: boolean;
  showReminderBanner: boolean;
};

export type AuthenticationUserContext = {
  role: string | null | undefined;
  mfaEnrolled: boolean;
  aal?: {
    currentLevel?: string | null;
    nextLevel?: string | null;
  };
};

/** Legacy roles that required MFA when mode is required_for_admins. */
export const MFA_ADMIN_ROLES = ["admin", "medico"] as const;

export function getDefaultMfaPolicy(): MfaPolicy {
  return {
    mode: "optional",
    showReminderBanner: true,
  };
}

export function mergeMfaPolicy(input?: MfaPolicyInput | null): MfaPolicy {
  const base = getDefaultMfaPolicy();
  if (!input) return base;
  return {
    mode: input.mode ?? base.mode,
    customRoles: input.customRoles ?? base.customRoles,
    showReminderBanner: input.showReminderBanner ?? base.showReminderBanner,
  };
}

function enrollmentRequiredForRole(policy: MfaPolicy, role: string | null | undefined): boolean {
  if (!role) return false;
  switch (policy.mode) {
    case "optional":
      return false;
    case "required_for_all":
      return true;
    case "required_for_admins":
      return (MFA_ADMIN_ROLES as readonly string[]).includes(role);
    case "custom":
      return Boolean(policy.customRoles?.includes(role));
    default:
      return false;
  }
}

/**
 * Domain decision for MFA. Consumers must not interpret MfaMode / roles.
 */
export function decideAuthentication(
  policy: MfaPolicy,
  user: AuthenticationUserContext
): AuthenticationDecision {
  const needsEnrollment =
    enrollmentRequiredForRole(policy, user.role) && !user.mfaEnrolled;

  const aalNeedsChallenge =
    user.mfaEnrolled &&
    user.aal?.currentLevel === "aal1" &&
    user.aal?.nextLevel === "aal2";

  return {
    challengeMfa: Boolean(aalNeedsChallenge),
    redirectToWizard: needsEnrollment,
    showReminderBanner:
      policy.showReminderBanner && !user.mfaEnrolled && !needsEnrollment,
  };
}

/** Active product policy (code default). Swap merge input later for clinic/env config. */
export function getActiveMfaPolicy(): MfaPolicy {
  return getDefaultMfaPolicy();
}
