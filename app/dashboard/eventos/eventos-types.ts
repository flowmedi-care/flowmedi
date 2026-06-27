export const EVENTS_LIST_LIMIT = 100;

export type EventCounts = {
  pending: number;
  completed: number;
  all: number;
};

export type ClinicEventConfigItem = {
  event_code: string;
  system_enabled: boolean;
};
