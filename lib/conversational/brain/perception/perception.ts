import {
  menuGoalFromReference,
  resolveMenuReference,
} from "../understanding/menu-reference-resolver";
import type { ClinicSummary } from "../types/turn-context";
import type { OperationalMemory } from "../types/memory";

export type PerceivedFacts = {
  date?: string;
  time?: string;
  timePreference?: string;
  procedureName?: string;
  procedureId?: string;
  confirmation?: boolean;
  cancel?: boolean;
  greeting?: boolean;
  thanks?: boolean;
  menuChoice?: number;
  menuGoal?: string;
  scheduleSignal?: boolean;
  priceSignal?: boolean;
  handoffSignal?: boolean;
  faqSignal?: boolean;
  discoverySignal?: boolean;
  query?: string;
};

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/amanhã|amanha/.test(lower)) return tomorrowIso();
  const m = lower.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return undefined;
}

function parseTime(text: string): string | undefined {
  const m = text.match(/(\d{1,2})[:h](\d{2})?/i);
  if (m) return `${m[1].padStart(2, "0")}:${(m[2] ?? "00").padStart(2, "0")}`;
  if (/manhã|manha/.test(text.toLowerCase())) return "manha";
  if (/tarde/.test(text.toLowerCase())) return "tarde";
  return undefined;
}

function matchProcedure(message: string, services: ClinicSummary["topServices"]) {
  const lower = message.toLowerCase();
  for (const s of services) {
    if (lower.includes(s.name.toLowerCase())) {
      return { id: s.id, name: s.name };
    }
  }
  return null;
}

export class Perception {
  extract(
    message: string,
    clinicSummary: ClinicSummary,
    memory: OperationalMemory
  ): PerceivedFacts {
    const lower = message.toLowerCase().trim();
    const facts: PerceivedFacts = { query: message };

    const menuRef = resolveMenuReference(message, memory);
    if (menuRef !== null) {
      facts.menuChoice = menuRef;
      facts.menuGoal = menuGoalFromReference(menuRef);
    }

    if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hi)\b/i.test(lower)) {
      facts.greeting = true;
    }
    if (/^(obrigad|valeu|agradeço|agradeco)/i.test(lower)) {
      facts.thanks = true;
      facts.greeting = true;
    }
    if (/^(sim|s|confirmo|ok)\b/i.test(lower)) facts.confirmation = true;
    if (/^(não|nao|cancelar)\b/i.test(lower)) facts.cancel = true;

    const date = parseDate(message);
    if (date) facts.date = date;
    const time = parseTime(message);
    if (time) facts.time = time;

    const proc = matchProcedure(message, clinicSummary.topServices);
    if (proc) {
      facts.procedureId = proc.id;
      facts.procedureName = proc.name;
    }

    if (/agendar|marcar|consulta|horário|horario|vaga/i.test(lower)) {
      facts.scheduleSignal = true;
    }
    if (/preço|preco|valor|quanto custa/i.test(lower)) facts.priceSignal = true;
    if (/atendente|humano|pessoa/i.test(lower) && !/não quero|nao quero/i.test(lower)) {
      facts.handoffSignal = true;
    }
    if (/horário de funcionamento|horario de funcionamento|onde fica|endereço|endereco/i.test(lower)) {
      facts.faqSignal = true;
    }
    if (/com o que|trabalham|fazem|serviço|servico|especialidade|procedimento/i.test(lower)) {
      facts.discoverySignal = true;
    }

    return facts;
  }
}
