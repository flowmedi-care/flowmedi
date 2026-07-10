import type { Timestamp } from "../shared/timestamp";

export type HandoffSession = {
  ticketId: string;
  startedAt: Timestamp;
};
