export type LeadStatus =
  | "landing_opened"
  | "hero_viewed"
  | "flow_viewed"
  | "demo_viewed"
  | "faq_viewed"
  | "cta_clicked"
  | "whatsapp_clicked";

const STATUS_ORDER: LeadStatus[] = [
  "landing_opened",
  "hero_viewed",
  "flow_viewed",
  "demo_viewed",
  "faq_viewed",
  "cta_clicked",
  "whatsapp_clicked",
];

export function statusRank(status: LeadStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/** Só avança; nunca regride. */
export function advanceLeadStatus(
  current: LeadStatus | null | undefined,
  next: LeadStatus
): LeadStatus {
  if (!current) return next;
  return statusRank(next) > statusRank(current) ? next : current;
}

export type ReturnAfterBucket =
  | "2m"
  | "30m"
  | "5h"
  | "1d"
  | "3d"
  | "7d+";

export function bucketReturnAfter(ms: number): ReturnAfterBucket {
  const m = ms / 60_000;
  if (m < 2) return "2m";
  if (m < 30) return "30m";
  if (m < 5 * 60) return "5h";
  if (m < 24 * 60) return "1d";
  if (m < 3 * 24 * 60) return "3d";
  return "7d+";
}

const STORAGE_PREFIX = "fm_outbound_";

export type VisitStore = {
  firstSeenAt: number;
  lastSeenAt: number;
};

function storageKey(lead: string | undefined): string {
  return `${STORAGE_PREFIX}visit_${lead || "anon"}`;
}

export function readVisitStore(lead?: string): VisitStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(lead));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitStore;
    if (!parsed.firstSeenAt || !parsed.lastSeenAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVisitStore(store: VisitStore, lead?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(lead), JSON.stringify(store));
  } catch {
    // ignore
  }
}

/**
 * Detecta retorno: já visitou antes e lastSeenAt foi há mais de 2 min.
 * Atualiza lastSeenAt; preserva firstSeenAt.
 */
export function touchVisit(lead?: string): {
  isReturn: boolean;
  returnAfter?: ReturnAfterBucket;
  firstSeenAt: number;
} {
  const now = Date.now();
  const prev = readVisitStore(lead);
  if (!prev) {
    writeVisitStore({ firstSeenAt: now, lastSeenAt: now }, lead);
    return { isReturn: false, firstSeenAt: now };
  }

  const gap = now - prev.lastSeenAt;
  const isReturn = gap >= 2 * 60_000;
  writeVisitStore({ firstSeenAt: prev.firstSeenAt, lastSeenAt: now }, lead);
  return {
    isReturn,
    returnAfter: isReturn ? bucketReturnAfter(gap) : undefined,
    firstSeenAt: prev.firstSeenAt,
  };
}
