/**
 * Cenários E2E conversacionais do assistente virtual.
 * Execute: npx tsx scripts/test-virtual-assistant-conversations.ts
 *
 * Testes unitários de lógica (sem OpenAI/Supabase). Para teste integrado,
 * use POST /api/whatsapp/assistant/simulate com processImmediately: true.
 */
import assert from "node:assert/strict";
import { detectInboundIntent, hasClearIntent } from "../lib/virtual-assistant/detect-inbound-intent";
import { parseConfirmationReply } from "../lib/virtual-assistant/confirmations";
import { formatAiStateForPrompt, buildToolRoundLimitFallback } from "../lib/virtual-assistant/format-ai-state";
import { isInsideHandoffWindow } from "../lib/virtual-assistant/handoff-hours";
import { isMenuNumericReply, looksLikeAutomatedMessage } from "../lib/virtual-assistant/bot-loop-guard";
import { shouldEscalateToHuman } from "../lib/virtual-assistant/escalation";

type ConversationScenario = {
  name: string;
  userMessage: string;
  expectIntent?: string;
  expectClearIntent?: boolean;
};

const SCENARIOS: ConversationScenario[] = [
  { name: "saudação genérica", userMessage: "Oi", expectClearIntent: false },
  { name: "agendar direto", userMessage: "Oi, quero agendar uma consulta", expectIntent: "booking", expectClearIntent: true },
  { name: "preço direto", userMessage: "Quanto custa a consulta?", expectIntent: "pricing", expectClearIntent: true },
  { name: "horário", userMessage: "Vocês abrem sábado?", expectIntent: "hours_location", expectClearIntent: true },
  { name: "minha consulta", userMessage: "Quando é minha consulta?", expectIntent: "my_appointments", expectClearIntent: true },
];

for (const scenario of SCENARIOS) {
  const intent = detectInboundIntent(scenario.userMessage);
  if (scenario.expectIntent) {
    assert.equal(intent, scenario.expectIntent, `${scenario.name}: intent`);
  }
  if (scenario.expectClearIntent !== undefined) {
    assert.equal(hasClearIntent(intent), scenario.expectClearIntent, `${scenario.name}: clear intent`);
  }
}

assert.equal(parseConfirmationReply("sim"), "yes");
assert.equal(parseConfirmationReply("não"), "clarify");
assert.equal(parseConfirmationReply("não vou"), "no_cancel");
assert.equal(parseConfirmationReply("remarcar"), "no_reschedule");
assert.equal(parseConfirmationReply("talvez"), null);

assert.match(
  formatAiStateForPrompt({ intent: "booking", procedure_id: "x", doctor_id: "y" }),
  /agendamento/
);
assert.match(buildToolRoundLimitFallback({ intent: "booking" }), /procedimento/i);

assert.equal(isMenuNumericReply("1"), true);
assert.equal(looksLikeAutomatedMessage("1", { intent: "booking" }), false);
assert.equal(looksLikeAutomatedMessage("Digite 1 para agendar"), true);

const insideHours = isInsideHandoffWindow({
  operating_hours: {
    mon: { open: "00:00", close: "23:59" },
    tue: { open: "00:00", close: "23:59" },
    wed: { open: "00:00", close: "23:59" },
    thu: { open: "00:00", close: "23:59" },
    fri: { open: "00:00", close: "23:59" },
    sat: { open: "00:00", close: "23:59" },
    sun: { open: "00:00", close: "23:59" },
  },
});
assert.equal(insideHours, true);

const paymentEscalation = shouldEscalateToHuman({ messageText: "Já paguei o pix" });
assert.equal(paymentEscalation.escalate, true);
assert.equal(paymentEscalation.trigger, "payment_proof_missing");

const priceQuestion = shouldEscalateToHuman({ messageText: "Aceita pix?" });
assert.equal(priceQuestion.escalate, false);

console.log(`All ${SCENARIOS.length} conversation scenario checks passed.`);
