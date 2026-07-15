import type { CheckInSettings } from "./types";

export function checkInDefaults(): CheckInSettings {
  return {
    enabled: false,
    opensBeforeHours: 2,
    closesAfterMinutes: 30,
    behavior: {
      whenUnavailable: "show_next_eligible",
      afterCheckIn: "confirm_patient_only",
    },
  };
}
