export type ConfirmationFlowTokenPayload = {
  c: string;
  a: string;
  p: string;
};

export function encodeConfirmationFlowToken(payload: ConfirmationFlowTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeConfirmationFlowToken(token: string): ConfirmationFlowTokenPayload | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Partial<ConfirmationFlowTokenPayload>;
    if (!parsed.c || !parsed.a || !parsed.p) return null;
    return { c: String(parsed.c), a: String(parsed.a), p: String(parsed.p) };
  } catch {
    return null;
  }
}

export type ConfirmationFlowAction = "confirmar" | "cancelar" | "remarcar";

export function parseConfirmationFlowAction(
  value: unknown
): ConfirmationFlowAction | null {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim();
  if (["confirmar", "confirm", "sim", "yes", "confirmar_presenca"].includes(normalized)) {
    return "confirmar";
  }
  if (["cancelar", "cancel", "nao", "não", "no", "nao_vou"].includes(normalized)) {
    return "cancelar";
  }
  if (["remarcar", "reschedule", "reagendar", "remarcacao"].includes(normalized)) {
    return "remarcar";
  }
  return null;
}

export function parseConfirmationButtonReplyId(
  buttonId: string
): ConfirmationFlowAction | null {
  const id = buttonId.toLowerCase().trim();
  if (id.includes("confirm") || id === "sim" || id === "yes") return "confirmar";
  if (id.includes("cancel") || id === "nao" || id === "no") return "cancelar";
  if (id.includes("resched") || id.includes("remarc") || id.includes("reagend")) {
    return "remarcar";
  }
  return null;
}
