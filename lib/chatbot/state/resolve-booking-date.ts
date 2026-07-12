import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/clinic-timezone";
import { extractDate } from "../extractors/date";
import type { OfferedDay } from "./types";

export type ResolveBookingDateMatchedBy =
  | "iso"
  | "index"
  | "label"
  | "mmdd"
  | "parsed"
  | "booking_date";

export type ResolveBookingDateReason =
  | "date_not_in_offered_days"
  | "ambiguous_mmdd"
  | "invalid_date"
  | "missing_date";

export type ResolveBookingDateResult =
  | { ok: true; date: string; matchedBy: ResolveBookingDateMatchedBy }
  | { ok: false; reason: ResolveBookingDateReason };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function mmddOf(iso: string): string | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  return iso.slice(5);
}

function normalizeLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract DD/MM from text for label matching (e.g. "15/07", "qua. 15/07"). */
function extractDayMonth(text: string): { day: number; month: number } | null {
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month };
}

function matchAgainstOffered(
  raw: string,
  offered: OfferedDay[]
): ResolveBookingDateResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "invalid_date" };

  // 1. ISO exact
  if (isValidIsoDate(trimmed)) {
    const exact = offered.find((d) => d.date === trimmed);
    if (exact) return { ok: true, date: exact.date, matchedBy: "iso" };
  }

  // 2. Index
  if (/^\d{1,2}$/.test(trimmed)) {
    const index = Number(trimmed);
    const byField = offered.find((o) => o.index === index);
    if (byField) return { ok: true, date: byField.date, matchedBy: "index" };
    const byPosition = offered[index - 1];
    if (byPosition) return { ok: true, date: byPosition.date, matchedBy: "index" };
  }

  // 3. Label (exact, fragment, DD/MM in label, weekday fragment)
  const norm = normalizeLabel(trimmed);
  const labelHits = offered.filter((d) => {
    const lab = normalizeLabel(d.label);
    if (!lab) return false;
    if (lab === norm) return true;
    if (norm.length >= 3 && (lab.includes(norm) || norm.includes(lab))) return true;
    return false;
  });
  if (labelHits.length === 1) {
    return { ok: true, date: labelHits[0].date, matchedBy: "label" };
  }

  const dm = extractDayMonth(trimmed);
  if (dm) {
    const dmHits = offered.filter((d) => {
      const fromLabel = extractDayMonth(d.label);
      if (fromLabel && fromLabel.day === dm.day && fromLabel.month === dm.month) {
        return true;
      }
      const offeredDm = mmddOf(d.date);
      if (!offeredDm) return false;
      const [mm, dd] = offeredDm.split("-").map(Number);
      return dd === dm.day && mm === dm.month;
    });
    if (dmHits.length === 1) {
      return { ok: true, date: dmHits[0].date, matchedBy: "label" };
    }
    if (dmHits.length > 1) {
      return { ok: false, reason: "ambiguous_mmdd" };
    }
  }

  // 4. MM-DD from ISO with wrong year (last resort)
  if (isValidIsoDate(trimmed)) {
    const needle = mmddOf(trimmed);
    if (needle) {
      const matches = offered.filter((d) => mmddOf(d.date) === needle);
      if (matches.length === 1) {
        return { ok: true, date: matches[0].date, matchedBy: "mmdd" };
      }
      if (matches.length > 1) {
        return { ok: false, reason: "ambiguous_mmdd" };
      }
    }
  }

  return { ok: false, reason: "date_not_in_offered_days" };
}

function parseStandalone(raw: string): ResolveBookingDateResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "invalid_date" };
  if (isValidIsoDate(trimmed)) {
    return { ok: true, date: trimmed, matchedBy: "parsed" };
  }
  const extracted = extractDate(trimmed);
  if (extracted && isValidIsoDate(extracted)) {
    return { ok: true, date: extracted, matchedBy: "parsed" };
  }
  return { ok: false, reason: "invalid_date" };
}

/**
 * Resolve booking date from LLM intent + offered days + state.
 * Tools must never trust args.date raw — always go through this helper.
 */
export function resolveBookingDate(opts: {
  dateArg?: unknown;
  offeredDays?: OfferedDay[];
  bookingDate?: string | null;
  clinicTimezone?: string;
  userMessage?: string | null;
}): ResolveBookingDateResult {
  void (opts.clinicTimezone ?? DEFAULT_CLINIC_TIMEZONE);

  const offered = (opts.offeredDays ?? []).filter((d) => d?.date);
  const candidates: Array<{ value: string; fromBooking: boolean }> = [];

  if (opts.dateArg != null && String(opts.dateArg).trim() !== "") {
    candidates.push({ value: String(opts.dateArg).trim(), fromBooking: false });
  }

  const userMessage = opts.userMessage?.trim();
  if (userMessage) {
    candidates.push({ value: userMessage, fromBooking: false });
    const extracted = extractDate(userMessage);
    if (extracted) {
      candidates.push({ value: extracted, fromBooking: false });
    }
  }

  if (opts.bookingDate != null && String(opts.bookingDate).trim() !== "") {
    candidates.push({
      value: String(opts.bookingDate).trim(),
      fromBooking: true,
    });
  }

  if (offered.length > 0) {
    if (candidates.length === 0) {
      return { ok: false, reason: "missing_date" };
    }
    let lastFail: ResolveBookingDateResult = {
      ok: false,
      reason: "date_not_in_offered_days",
    };
    for (const c of candidates) {
      const result = matchAgainstOffered(c.value, offered);
      if (result.ok) {
        if (c.fromBooking && result.matchedBy === "iso") {
          return { ok: true, date: result.date, matchedBy: "booking_date" };
        }
        return result;
      }
      if (result.reason === "ambiguous_mmdd") return result;
      lastFail = result;
    }
    return lastFail;
  }

  if (candidates.length === 0) {
    return { ok: false, reason: "missing_date" };
  }

  for (const c of candidates) {
    const result = parseStandalone(c.value);
    if (result.ok) {
      return c.fromBooking
        ? { ok: true, date: result.date, matchedBy: "booking_date" }
        : result;
    }
  }

  return { ok: false, reason: "invalid_date" };
}

export function resolveBookingDateFailureMessage(
  reason: ResolveBookingDateReason
): string {
  switch (reason) {
    case "ambiguous_mmdd":
      return "Há mais de um dia com essa data na lista. Escolha pelo número da opção.";
    case "missing_date":
      return "Informe o dia desejado a partir das opções oferecidas.";
    case "invalid_date":
      return "Não entendi a data. Escolha um dos dias listados.";
    case "date_not_in_offered_days":
    default:
      return "Essa data não está entre os dias oferecidos. Escolha um dos dias listados.";
  }
}
