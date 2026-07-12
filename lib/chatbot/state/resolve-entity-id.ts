import type { OfferedOption } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEntityUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function resolveFromOffered(
  offered: OfferedOption[] | undefined,
  raw: string
): string | null {
  if (!offered?.length) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const numMatch = trimmed.match(/^\d{1,2}$/);
  if (numMatch) {
    const index = Number(numMatch[0]);
    const byField = offered.find((o) => o.index === index);
    if (byField) return byField.id;
    const byPosition = offered[index - 1];
    if (byPosition) return byPosition.id;
  }

  const byId = offered.find((o) => o.id === trimmed);
  if (byId) return byId.id;

  const lower = trimmed.toLowerCase();
  const byName = offered.find((o) => o.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;

  return null;
}

/**
 * Resolve doctor/procedure id from tool args + offered options + existing state.
 * Rejects bare menu indices, slugs without offered match, and patient_id leaks.
 */
export function resolveBookingEntityId(opts: {
  arg?: unknown;
  stateId?: string | null;
  offered?: OfferedOption[];
  /** Never accept this as a booking entity id (e.g. patient UUID). */
  rejectId?: string | null;
}): string {
  const reject = opts.rejectId?.trim() || "";

  const tryResolve = (raw: string): string | null => {
    const v = raw.trim();
    if (!v) return null;
    if (reject && v === reject) return null;

    const fromOffered = resolveFromOffered(opts.offered, v);
    if (fromOffered) return fromOffered;

    if (isEntityUuid(v)) return v;
    return null;
  };

  if (opts.arg != null && String(opts.arg).trim() !== "") {
    const fromArg = tryResolve(String(opts.arg));
    if (fromArg) return fromArg;
  }

  if (opts.stateId) {
    const fromState = tryResolve(opts.stateId);
    if (fromState) return fromState;
  }

  return "";
}
