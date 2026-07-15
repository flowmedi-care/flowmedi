import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveReply,
  shouldSkipLlmForAuthoritativeReply,
} from "../reply-policy";

describe("ReplyPolicy", () => {
  it("structured beats domain and llm", () => {
    const d = resolveReply({
      structuredReply: "Você tem 1 consulta:\n1. …",
      structuredReason: "tool_list_renderer",
      domainMessage: "Não há consultas…",
      llmReply: "Vou listar…",
      fallbackReply: "Posso ajudar?",
    });
    assert.equal(d.source, "structured");
    assert.equal(d.llmUsed, false);
    assert.match(d.reply, /1 consulta/);
  });

  it("domain beats llm when no structured", () => {
    const d = resolveReply({
      domainMessage: "Não há consultas elegíveis para check-in no momento.",
      domainReason: "check_in_no_eligible",
      llmReply: "Vou verificar sua agenda.",
      fallbackReply: "Posso ajudar?",
    });
    assert.equal(d.source, "domain");
    assert.equal(d.reason, "check_in_no_eligible");
    assert.equal(d.llmUsed, false);
  });

  it("skip LLM when authoritative present", () => {
    assert.equal(shouldSkipLlmForAuthoritativeReply("lista", null), true);
    assert.equal(shouldSkipLlmForAuthoritativeReply(null, "msg"), true);
    assert.equal(shouldSkipLlmForAuthoritativeReply(null, null), false);
  });
});
