/**
 * Testes manuais para utilitários do assistente virtual.
 * Execute: npx tsx scripts/test-virtual-assistant.ts
 */
import assert from "node:assert/strict";
import { normalizePhoneForMatch, phonesMatch } from "../lib/virtual-assistant/patient-lookup";
import { parseConfirmationReply } from "../lib/virtual-assistant/confirmations";
import { shouldAutoHandoff } from "../lib/virtual-assistant/handoff-patterns";
import { parseUserAiCommand } from "../lib/virtual-assistant/user-commands";
import { looksLikeAutomatedMessage, isMenuNumericReply } from "../lib/virtual-assistant/bot-loop-guard";
import { detectInboundIntent } from "../lib/virtual-assistant/detect-inbound-intent";

assert.equal(normalizePhoneForMatch("5562999999999"), "62999999999");
assert.equal(phonesMatch("62999999999", "5562999999999"), true);
assert.equal(parseConfirmationReply("sim"), "yes");
assert.equal(parseConfirmationReply("não vou"), "no_cancel");
assert.equal(parseConfirmationReply("não"), "clarify");
assert.equal(parseConfirmationReply("talvez"), null);
assert.equal(shouldAutoHandoff("quero falar com atendente"), true);
assert.equal(shouldAutoHandoff("qual o horário?"), false);
assert.equal(detectInboundIntent("quero agendar"), "booking");
assert.equal(isMenuNumericReply("2"), true);

assert.equal(parseUserAiCommand("DESATIVE as respostas de IA"), "opt_out");
assert.equal(parseUserAiCommand("ATIVAR"), "opt_in");
assert.equal(parseUserAiCommand("ativar respostas de ia"), "opt_in");
assert.equal(parseUserAiCommand("quero falar com atendente"), "handoff");
assert.equal(parseUserAiCommand("desative as respostas de ia e fale com atendente"), "opt_out");
assert.equal(parseUserAiCommand("qual o horário?"), null);
assert.equal(looksLikeAutomatedMessage("Digite 1 para agendar sua consulta"), true);
assert.equal(looksLikeAutomatedMessage("Bom dia, gostaria de remarcar"), false);

console.log("All virtual-assistant unit checks passed.");
