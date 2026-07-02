/**
 * Cenários E2E conversacionais do assistente virtual.
 * Execute: npx tsx scripts/test-virtual-assistant-conversations.ts
 */
import assert from "node:assert/strict";
import { detectInboundIntent, hasClearIntent } from "../lib/virtual-assistant/detect-inbound-intent";
import { parseConfirmationReply } from "../lib/virtual-assistant/confirmations";
import { formatAiStateForPrompt, buildToolRoundLimitFallback, getBookingStepLabel } from "../lib/virtual-assistant/format-ai-state";
import { isInsideHandoffWindow } from "../lib/virtual-assistant/handoff-hours";
import { isMenuNumericReply, looksLikeAutomatedMessage } from "../lib/virtual-assistant/bot-loop-guard";
import { shouldEscalateToHuman } from "../lib/virtual-assistant/escalation";
import { applyReplyGuards, isMetaFlowQuestion, buildMetaFlowReply } from "../lib/virtual-assistant/reply-guards";
import { routeInboundFlow } from "../lib/virtual-assistant/intent-router";
import { composeSystemPrompt, resolvePromptFlow } from "../lib/virtual-assistant/prompt/prompt-compose";
import { buildPromptTools } from "../lib/virtual-assistant/prompt/prompt-tools";
import { FEW_SHOT_EXAMPLES } from "../lib/virtual-assistant/prompt/prompt-examples";
import { patchBookingStepFromTool } from "../lib/virtual-assistant/booking-flow";

const SCENARIOS = [
  { name: "saudação genérica", userMessage: "Oi", expectClearIntent: false },
  { name: "agendar direto", userMessage: "Oi, quero agendar uma consulta", expectIntent: "booking", expectClearIntent: true },
  { name: "preço direto", userMessage: "Quanto custa a consulta?", expectIntent: "pricing", expectClearIntent: true },
  { name: "horário", userMessage: "Vocês abrem sábado?", expectIntent: "hours_location", expectClearIntent: true },
  { name: "minha consulta", userMessage: "Quando é minha consulta?", expectIntent: "my_appointments", expectClearIntent: true },
];

for (const scenario of SCENARIOS) {
  const intent = detectInboundIntent(scenario.userMessage);
  if ("expectIntent" in scenario && scenario.expectIntent) {
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

assert.match(formatAiStateForPrompt({ intent: "booking", booking_step: "slot" }), /horário/);
assert.equal(getBookingStepLabel("done"), "concluído");

assert.equal(isMenuNumericReply("1"), true);
assert.equal(looksLikeAutomatedMessage("1", { intent: "booking" }), false);

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

assert.equal(shouldEscalateToHuman({ messageText: "Já paguei o pix" }).escalate, true);
assert.equal(shouldEscalateToHuman({ messageText: "Aceita pix?" }).escalate, false);

assert.equal(isMetaFlowQuestion("Em qual etapa do fluxo eu estou?"), true);
assert.match(
  buildMetaFlowReply({ booking_step: "slot", intent: "booking" }) ?? "",
  /horário/
);

const routed = routeInboundFlow({
  messageText: "quero agendar",
  detectedIntent: "booking",
  aiState: {},
});
assert.equal(routed.flow, "booking");
assert.equal(routed.useBookingMachine, true);

const falseConfirm = applyReplyGuards("Seu agendamento está confirmado!", { booking_step: "slot" });
assert.ok(!/confirmad/i.test(falseConfirm) || /finalizando/i.test(falseConfirm));

const phoneGuard = applyReplyGuards("Pode me passar seu telefone?", { booking_step: "patient" });
assert.ok(!/telefone/i.test(phoneGuard) || /WhatsApp/i.test(phoneGuard));

const prompt = composeSystemPrompt({
  clinicName: "Clínica Teste",
  assistantName: "Flow",
  settings: { tone: "informal" },
  clinicData: "# Procedimentos\n- Consulta",
  flow: "booking",
  aiState: { booking_step: "slot" },
  whatsappPhone: "62999999999",
});
assert.ok(prompt.includes("NUNCA peça telefone"));
assert.ok(prompt.includes("find_available_slots"));
assert.ok(prompt.includes("Prioridades"));

assert.ok(buildPromptTools("booking").includes("lookup_patient_by_phone"));
assert.ok(FEW_SHOT_EXAMPLES.length >= 35);

const createPatch = patchBookingStepFromTool(
  "create_appointment",
  {},
  { appointmentId: "abc-123" },
  { intent: "booking", booking_step: "confirm" }
);
assert.equal(createPatch.booking_step, "done");
assert.equal(createPatch.last_created_appointment_id, "abc-123");

assert.equal(resolvePromptFlow({ intent: "booking" }), "booking");
assert.equal(resolvePromptFlow({ intent: "pricing" }), "pricing");

console.log(`All ${SCENARIOS.length} conversation scenario checks + architecture checks passed.`);
