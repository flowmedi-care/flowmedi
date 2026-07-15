import type {
  CheckInAfterCheckIn,
  CheckInWhenUnavailable,
} from "@/lib/attendance-flow/types";

export type CheckInSettings = {
  enabled: boolean;
  opensBeforeHours: number;
  closesAfterMinutes: number;
  behavior: {
    whenUnavailable: CheckInWhenUnavailable;
    afterCheckIn: CheckInAfterCheckIn;
  };
};
