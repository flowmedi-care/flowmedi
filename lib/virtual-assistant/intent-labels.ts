const INTENT_LABELS: Record<string, string> = {
  booking: "Agendamento",
  availability_check: "Disponibilidade",
  greeting: "Saudação",
  pricing: "Preços",
  quote: "Orçamento",
  my_appointments: "Minhas consultas",
  cancel: "Cancelamento",
  payment: "Pagamento",
  form: "Formulário",
  human_handoff: "Falar com humano",
  reschedule: "Remarcar",
  hours_location: "Horário/local",
  unknown: "Desconhecido",
  general: "Geral",
};

const INTENT_COLORS: Record<string, string> = {
  booking: "bg-violet-100 text-violet-800 border-violet-300",
  availability_check: "bg-sky-100 text-sky-800 border-sky-300",
  greeting: "bg-slate-100 text-slate-700 border-slate-300",
  pricing: "bg-cyan-100 text-cyan-800 border-cyan-300",
  quote: "bg-amber-100 text-amber-800 border-amber-300",
  my_appointments: "bg-blue-100 text-blue-800 border-blue-300",
  cancel: "bg-orange-100 text-orange-800 border-orange-300",
  payment: "bg-emerald-100 text-emerald-800 border-emerald-300",
  form: "bg-indigo-100 text-indigo-800 border-indigo-300",
  human_handoff: "bg-red-100 text-red-800 border-red-300",
  unknown: "bg-red-100 text-red-800 border-red-300",
  general: "bg-gray-100 text-gray-700 border-gray-300",
};

const SOURCE_LABELS: Record<string, string> = {
  continuity: "Continuidade booking",
  regex_fast_path: "Regex",
  llm: "LLM",
};

export function getIntentLabel(intent: string): string {
  return INTENT_LABELS[intent] ?? intent;
}

export function getIntentColorClass(intent: string): string {
  return INTENT_COLORS[intent] ?? "bg-gray-100 text-gray-700 border-gray-300";
}

export function getIntentSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function isLowConfidenceIntent(confidence: number | undefined): boolean {
  return confidence !== undefined && confidence < 0.7;
}

export function isIntentMismatch(
  detectedIntent: string | undefined,
  continuityIntent: string | undefined
): boolean {
  if (!detectedIntent || !continuityIntent) return false;
  if (continuityIntent === detectedIntent) return false;
  const bookingGroup = new Set(["booking", "availability_check"]);
  if (bookingGroup.has(detectedIntent) && bookingGroup.has(continuityIntent)) return false;
  return true;
}
