/**
 * Testes manuais para utilitários do assistente virtual.
 * Execute: npx tsx scripts/test-virtual-assistant.ts
 */
import assert from "node:assert/strict";
import { normalizePhoneForMatch, phonesMatch } from "../lib/virtual-assistant/patient-lookup";
import { parseConfirmationReply } from "../lib/virtual-assistant/confirmations";
import { shouldAutoHandoff } from "../lib/virtual-assistant/agent";

assert.equal(normalizePhoneForMatch("5562999999999"), "62999999999");
assert.equal(phonesMatch("62999999999", "5562999999999"), true);
assert.equal(parseConfirmationReply("sim"), "yes");
assert.equal(parseConfirmationReply("não vou"), "no");
assert.equal(parseConfirmationReply("talvez"), null);
assert.equal(shouldAutoHandoff("quero falar com atendente"), true);
assert.equal(shouldAutoHandoff("qual o horário?"), false);

console.log("All virtual-assistant unit checks passed.");
