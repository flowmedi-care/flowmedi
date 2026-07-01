/**
 * Verificação dos parsers do WhatsApp Flow de confirmação (sem dependências).
 * Uso: node scripts/verify-confirmation-flow.mjs
 */

function encodeConfirmationFlowToken(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeConfirmationFlowToken(token) {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.c || !parsed.a || !parsed.p) return null;
    return { c: String(parsed.c), a: String(parsed.a), p: String(parsed.p) };
  } catch {
    return null;
  }
}

function parseConfirmationFlowAction(value) {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (["confirmar", "confirm", "sim", "yes"].includes(normalized)) return "confirmar";
  if (["cancelar", "cancel", "nao", "não", "no"].includes(normalized)) return "cancelar";
  if (["remarcar", "reschedule", "reagendar"].includes(normalized)) return "remarcar";
  return null;
}

let failed = 0;

function assert(name, condition) {
  if (!condition) {
    console.error("FAIL:", name);
    failed++;
  } else {
    console.log("OK:", name);
  }
}

const token = encodeConfirmationFlowToken({
  c: "clinic-1",
  a: "appt-1",
  p: "patient-1",
});
const decoded = decodeConfirmationFlowToken(token);
assert("token roundtrip", decoded?.a === "appt-1" && decoded?.p === "patient-1");
assert("confirmar", parseConfirmationFlowAction("confirmar") === "confirmar");
assert("cancelar", parseConfirmationFlowAction("nao") === "cancelar");
assert("remarcar", parseConfirmationFlowAction("remarcar") === "remarcar");

const flowJson = JSON.parse('{"action":"confirmar","appointment_id":"x"}');
assert("flow json action", parseConfirmationFlowAction(flowJson.action) === "confirmar");

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll confirmation flow parser checks passed.");
