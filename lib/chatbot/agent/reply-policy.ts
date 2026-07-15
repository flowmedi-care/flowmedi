/**
 * ReplyPolicy — structured / domain message beat the LLM (no-promise).
 * Prompt may reinforce; this module is the architectural guarantee.
 */

export type ReplySource = "structured" | "domain" | "llm" | "fallback";

export type ReplyDecision = {
  reply: string;
  source: ReplySource;
  reason: string;
  llmUsed: boolean;
};

export type ReplyPolicyInput = {
  /** Renderer output from ToolEnvelope (renderStrategy). */
  structuredReply?: string | null;
  structuredReason?: string;
  /** Tool / domain message when no structured projection. */
  domainMessage?: string | null;
  domainReason?: string;
  /** LLM completion when levels 1–2 absent. */
  llmReply?: string | null;
  llmReason?: string;
  /** Static fallback when nothing else. */
  fallbackReply: string;
  fallbackReason?: string;
};

/**
 * Cascata: Structured → Domain → LLM → Fallback.
 * Níveis 1–2 → llmUsed false (LLM não deve ter rodado / não é autoridade).
 */
export function resolveReply(input: ReplyPolicyInput): ReplyDecision {
  const structured = input.structuredReply?.trim();
  if (structured) {
    return {
      reply: structured,
      source: "structured",
      reason: input.structuredReason ?? "structured_renderer",
      llmUsed: false,
    };
  }

  const domain = input.domainMessage?.trim();
  if (domain) {
    return {
      reply: domain,
      source: "domain",
      reason: input.domainReason ?? "domain_message",
      llmUsed: false,
    };
  }

  const llm = input.llmReply?.trim();
  if (llm) {
    return {
      reply: llm,
      source: "llm",
      reason: input.llmReason ?? "llm_completion",
      llmUsed: true,
    };
  }

  return {
    reply: input.fallbackReply,
    source: "fallback",
    reason: input.fallbackReason ?? "fallback_static",
    llmUsed: false,
  };
}

/** True when levels 1–2 already produced a patient-visible reply — LLM must not run. */
export function shouldSkipLlmForAuthoritativeReply(
  structuredReply: string | null | undefined,
  domainMessage: string | null | undefined
): boolean {
  return Boolean(structuredReply?.trim() || domainMessage?.trim());
}
