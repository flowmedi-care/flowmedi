export type ToolKind = "query" | "command";

export type ToolName =
  | "checkConsent"
  | "recordConsent"
  | "findPatient"
  | "createPatient"
  | "listServices"
  | "listSlots"
  | "createAppointment"
  | "cancelAppointment"
  | "rescheduleAppointment"
  | "getPriceQuote"
  | "searchFaq"
  | "createLead"
  | "openHandoffTicket"
  | "appendHandoffMessage";

export type ToolDefinition = {
  name: ToolName;
  kind: ToolKind;
  idempotent: boolean;
  cacheTtlMs?: number;
};

export const TOOL_REGISTRY: Record<ToolName, ToolDefinition> = {
  checkConsent: { name: "checkConsent", kind: "query", idempotent: true, cacheTtlMs: 60_000 },
  recordConsent: { name: "recordConsent", kind: "command", idempotent: true },
  findPatient: { name: "findPatient", kind: "query", idempotent: true, cacheTtlMs: 30_000 },
  createPatient: { name: "createPatient", kind: "command", idempotent: true },
  listServices: { name: "listServices", kind: "query", idempotent: true, cacheTtlMs: 120_000 },
  listSlots: { name: "listSlots", kind: "query", idempotent: true, cacheTtlMs: 15_000 },
  createAppointment: { name: "createAppointment", kind: "command", idempotent: true },
  cancelAppointment: { name: "cancelAppointment", kind: "command", idempotent: true },
  rescheduleAppointment: { name: "rescheduleAppointment", kind: "command", idempotent: true },
  getPriceQuote: { name: "getPriceQuote", kind: "query", idempotent: true, cacheTtlMs: 60_000 },
  searchFaq: { name: "searchFaq", kind: "query", idempotent: true, cacheTtlMs: 300_000 },
  createLead: { name: "createLead", kind: "command", idempotent: true },
  openHandoffTicket: { name: "openHandoffTicket", kind: "command", idempotent: true },
  appendHandoffMessage: { name: "appendHandoffMessage", kind: "command", idempotent: false },
};

export type HandlerDomainAllowlist = {
  domain: string;
  fsmState: string;
  tools: ToolName[];
};

export const TOOL_ALLOWLIST: HandlerDomainAllowlist[] = [
  { domain: "system", fsmState: "consent.pending", tools: ["recordConsent", "checkConsent"] },
  { domain: "booking", fsmState: "booking.collect_patient", tools: ["findPatient", "createPatient"] },
  { domain: "booking", fsmState: "booking.collect_service", tools: ["listServices"] },
  { domain: "booking", fsmState: "booking.collect_datetime", tools: ["listSlots"] },
  { domain: "booking", fsmState: "booking.confirm", tools: ["createAppointment", "cancelAppointment", "rescheduleAppointment"] },
  { domain: "pricing", fsmState: "pricing.collect_service", tools: ["listServices"] },
  { domain: "pricing", fsmState: "pricing.present", tools: ["getPriceQuote"] },
  { domain: "faq", fsmState: "faq.ask", tools: ["searchFaq", "listServices"] },
  { domain: "discovery", fsmState: "discovery.present", tools: ["listServices"] },
  { domain: "crm", fsmState: "crm.collect_contact", tools: ["createPatient"] },
  { domain: "crm", fsmState: "crm.collect_interest", tools: ["createLead"] },
  { domain: "handoff", fsmState: "handoff.pending", tools: ["openHandoffTicket"] },
  { domain: "handoff", fsmState: "handoff.active", tools: ["appendHandoffMessage"] },
  { domain: "brain", fsmState: "brain.active", tools: ["listServices", "searchFaq", "getPriceQuote", "listSlots", "findPatient", "createPatient", "createLead", "openHandoffTicket", "createAppointment", "cancelAppointment", "rescheduleAppointment"] },
];

export function isToolAllowed(domain: string, fsmState: string, toolName: ToolName): boolean {
  return TOOL_ALLOWLIST.some(
    (entry) =>
      entry.domain === domain &&
      entry.fsmState === fsmState &&
      entry.tools.includes(toolName)
  );
}
