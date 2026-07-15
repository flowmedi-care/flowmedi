import type { AppointmentPolicy, CheckInPolicyInput } from "@/lib/attendance-flow/types";
import { checkInDefaults } from "./defaults";
import type { CheckInSettings } from "./types";

export function policyToCheckInSettings(policy: AppointmentPolicy): CheckInSettings {
  const d = checkInDefaults();
  const c = policy.check_in;
  return {
    enabled: c?.enabled ?? d.enabled,
    opensBeforeHours: c?.window?.opens_before_hours ?? d.opensBeforeHours,
    closesAfterMinutes: c?.window?.closes_after_minutes ?? d.closesAfterMinutes,
    behavior: {
      whenUnavailable: c?.when_unavailable ?? d.behavior.whenUnavailable,
      afterCheckIn: c?.after_check_in ?? d.behavior.afterCheckIn,
    },
  };
}

export function checkInSettingsToPolicyInput(value: CheckInSettings): CheckInPolicyInput {
  return {
    enabled: value.enabled,
    window: {
      opens_before_hours: value.opensBeforeHours,
      closes_after_minutes: value.closesAfterMinutes,
    },
    when_unavailable: value.behavior.whenUnavailable,
    after_check_in: value.behavior.afterCheckIn,
  };
}
