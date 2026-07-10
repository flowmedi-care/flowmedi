import type { ClinicConfig } from "../../clinic/clinic-config";
import type { Conversation } from "../../domain/conversation/conversation";
import type { HistoryMessage } from "./messages";
import type { OperationalMemory } from "./memory";

export type ClinicSummary = {
  clinicName: string;
  topServices: Array<{ id: string; name: string }>;
  hoursText: string;
  address: string | null;
};

export type TurnContext = {
  conversation: Conversation;
  config: ClinicConfig;
  message: string;
  phoneNumber: string;
  turnId: string;
  history: HistoryMessage[];
  operationalMemory: OperationalMemory;
  clinicSummary: ClinicSummary;
  patientJourney?: string;
};
