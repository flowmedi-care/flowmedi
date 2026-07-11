import type { ToolResult, ToolResultStatus } from "./types";
import type { MutationOutcome } from "./mutation-result";

const INFRA_PATTERNS = [
  /timeout/i,
  /ECONNRESET/i,
  /network/i,
  /503/,
  /502/,
  /500/,
  /column .* does not exist/i,
  /intake_pendencies/i,
  /connection/i,
  /fetch failed/i,
];

const BUSINESS_PATTERNS = [
  /cpf/i,
  /inv[aá]lid/i,
  /conflit/i,
  /ocupad/i,
  /indispon[ií]vel/i,
  /hor[aá]rio/i,
  /n[aã]o est[aá] entre/i,
  /limite de consultas/i,
  /sala livre/i,
  /n[aã]o encontrad/i,
];

export function classifyErrorMessage(message: string): MutationOutcome {
  const m = message.trim();
  if (!m) return "infrastructure";
  if (INFRA_PATTERNS.some((p) => p.test(m))) return "infrastructure";
  if (BUSINESS_PATTERNS.some((p) => p.test(m))) return "business";
  return "business";
}

export function outcomeFromToolResult(result: ToolResult): MutationOutcome {
  switch (result.status as ToolResultStatus) {
    case "success":
      return "success";
    case "needs_input":
    case "not_found":
      return "recoverable";
    case "unavailable":
      return "business";
    case "error":
      return classifyErrorMessage(result.message ?? "");
    default:
      return "business";
  }
}

export function outcomeFromServiceError(error: string | null | undefined): MutationOutcome {
  if (!error) return "success";
  return classifyErrorMessage(error);
}
