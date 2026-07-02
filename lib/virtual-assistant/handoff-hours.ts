import type { VirtualAssistantSettings } from "./types";
import { DAY_LABELS, type DayKey } from "./types";

function parseTimeToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

type HandoffHoursConfig = {
  days?: Partial<Record<DayKey, { open?: string; close?: string; closed?: boolean }>>;
  /** Fallback: usa operating_hours da clínica se handoff não tiver dias */
  useOperatingHours?: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
};

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function dayKeyFromDate(d: Date): DayKey {
  return DAY_KEYS[d.getDay()]!;
}

/**
 * Verifica se handoff humano está permitido no horário atual.
 * Se human_handoff_hours estiver vazio, usa operating_hours; se ambos vazios, permite 24h.
 */
export function isInsideHandoffWindow(
  settings: Partial<VirtualAssistantSettings>
): boolean {
  const raw = settings.human_handoff_hours as HandoffHoursConfig | null | undefined;
  const hours =
    raw?.days && Object.keys(raw.days).length > 0
      ? raw.days
      : settings.operating_hours;

  if (!hours || Object.keys(hours).length === 0) return true;

  const now = new Date();
  const key = dayKeyFromDate(now);
  const day = hours[key];
  if (!day) return true;
  if (day.closed) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(day.open, 0);
  const end = parseTimeToMinutes(day.close, 24 * 60 - 1);
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

export function handoffOutsideHoursMessage(settings: Partial<VirtualAssistantSettings>): string {
  const hours = settings.operating_hours;
  if (!hours) {
    return "No momento a equipe não está disponível para atendimento humano. Posso ajudar por aqui ou você pode deixar sua mensagem que retornamos no próximo horário útil.";
  }
  const key = dayKeyFromDate(new Date());
  const day = hours[key];
  if (day?.closed) {
    return `Hoje estamos fechados. Posso ajudar com agendamento e valores por aqui, ou deixe sua mensagem que retornamos ${DAY_LABELS[key === "sun" ? "mon" : "mon"]}.`;
  }
  const open = day?.open ?? "08:00";
  return `A equipe humana atende das ${open} em dias úteis. Posso resolver agendamento e valores agora — o que você precisa?`;
}

/** Minutos após handoff sem resposta humana para reativar IA (default 30). */
export const DEFAULT_HANDOFF_REACTIVATION_MINUTES = 30;

export function getHandoffReactivationMinutes(
  settings: Partial<VirtualAssistantSettings>
): number {
  const raw = settings.human_handoff_hours as { reactivation_minutes?: number } | null;
  const n = Number(raw?.reactivation_minutes);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_HANDOFF_REACTIVATION_MINUTES;
}
