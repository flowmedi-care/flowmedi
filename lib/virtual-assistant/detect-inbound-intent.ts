import type { AiConversationState } from "./types";

/** Intenções detectáveis antes do agente OpenAI — reduz menu forçado e pré-preenche ai_state. */
export type InboundIntent =
  | "booking"
  | "availability_check"
  | "pricing"
  | "hours_location"
  | "my_appointments"
  | "human_handoff"
  | "reschedule"
  | "cancel"
  | "payment"
  | "form"
  | "quote"
  | "greeting"
  | "general"
  | "unknown";

const BOOKING = [
  /\b(agendar|marcar|marcação|marcaçao|consulta nova|quero consulta)\b/i,
  /\b(quero|preciso|gostaria).{0,30}(consulta|procedimento|exame|retorno)\b/i,
];
const PRICING = [
  /\b(quanto custa|valor|preço|preco|valores|convênio|convenio|particular)\b/i,
  /\bcusta\b/i,
];
const AVAILABILITY = [
  /\b(tem|há|ha)\s+(vaga|horário|horario|horários|horarios)\b/i,
  /\b(tem|há|ha).{0,25}(horário|horario|horários|horarios)\b/i,
  /\b(semana que vem|próxima semana|proxima semana)\b/i,
  /\b(disponib|liberado|encaixe)\b/i,
  /\bquando (tem|posso|consigo)\b/i,
  /\btem vaga\b/i,
  /\b(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo).{0,30}(manh[aã]|tarde)\b/i,
];
const HOURS = [
  /\b(horário de funcionamento|horario de funcionamento|funcionamento|abre|abrem|fecha)\b/i,
  /\b(endereço|endereco|localização|localizacao|onde fica|como chegar|estacionamento)\b/i,
];
const MY_APPTS = [
  /\b(minha consulta|minhas consultas|meu agendamento|quando é minha|tenho consulta)\b/i,
];
const HUMAN = [
  /falar com (um(a)? )?(atendente|humano|pessoa)/i,
  /quero (um )?atendente/i,
];
const RESCHEDULE = [/\b(remarcar|reagendar|mudar (o )?horário|mudar (o )?horario)\b/i];
const CANCEL = [/\b(cancelar|desmarcar)\b.{0,20}(consulta|agendamento)?/i];
const PAYMENT = [/\b(pagamento|paguei|pix|comprovante|boleto|pagar)\b/i];
const FORM = [/\b(formulário|formulario|formulários|formularios)\b/i];
const QUOTE = [/\b(orçamento|orcamento)\b/i];
const GREETING_ONLY = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e aí|e ai)[\s!.?]*$/i;

export function detectInboundIntent(
  text: string,
  aiState?: AiConversationState
): InboundIntent {
  const t = text.trim();
  if (!t) return "unknown";
  if (GREETING_ONLY.test(t)) return "greeting";
  if (HUMAN.some((p) => p.test(t))) return "human_handoff";
  if (RESCHEDULE.some((p) => p.test(t))) return "reschedule";
  if (CANCEL.some((p) => p.test(t))) return "cancel";
  if (PAYMENT.some((p) => p.test(t))) return "payment";
  if (FORM.some((p) => p.test(t))) return "form";
  if (QUOTE.some((p) => p.test(t))) return "quote";
  if (MY_APPTS.some((p) => p.test(t))) return "my_appointments";
  if (PRICING.some((p) => p.test(t))) return "pricing";
  if (AVAILABILITY.some((p) => p.test(t))) return "availability_check";
  if (HOURS.some((p) => p.test(t))) return "hours_location";
  if (BOOKING.some((p) => p.test(t))) return "booking";

  if (aiState && (aiState.booking_step === "day" || aiState.booking_step === "slot")) {
    if (/^\s*(de\s+)?(manh[aã]|tarde)\s*[!.?]*$/i.test(t)) return "availability_check";
    if (/^\s*\d{1,2}\s*$/.test(t)) return "availability_check";
    if (/\b(manh[aã]|tarde)\b/i.test(t)) return "availability_check";
  }

  return "unknown";
}

export function hasClearIntent(intent: InboundIntent): boolean {
  return intent !== "unknown" && intent !== "greeting";
}

export function intentToAiStatePatch(intent: InboundIntent): { intent?: string } {
  switch (intent) {
    case "booking":
    case "availability_check":
    case "reschedule":
      return { intent: "booking" };
    case "pricing":
    case "quote":
      return { intent: "pricing" };
    case "my_appointments":
      return { intent: "my_appointments" };
    case "cancel":
      return { intent: "cancel" };
    case "payment":
      return { intent: "payment" };
    case "form":
      return { intent: "form" };
    default:
      return {};
  }
}
