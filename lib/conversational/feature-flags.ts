import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";

export type NorthStarMode = "off" | "shadow" | "canary" | "full";

export type NorthStarFeatureFlags = {
  mode: NorthStarMode;
  /** Clínica piloto quando mode === canary */
  canaryClinicIds: string[];
};

const DEFAULT_FLAGS: NorthStarFeatureFlags = {
  mode: "off",
  canaryClinicIds: [],
};

export function northStarFlagsFromSettings(
  settings: Partial<VirtualAssistantSettings>
): NorthStarFeatureFlags {
  const raw = settings as Partial<VirtualAssistantSettings> & {
    north_star_enabled?: boolean;
    north_star_mode?: NorthStarMode;
    north_star_canary_clinic_ids?: string[];
  };

  if (raw.north_star_mode) {
    return {
      mode: raw.north_star_mode,
      canaryClinicIds: raw.north_star_canary_clinic_ids ?? [],
    };
  }

  if (raw.north_star_enabled === true) {
    return { mode: "full", canaryClinicIds: [] };
  }

  return DEFAULT_FLAGS;
}

export function shouldRunNorthStar(
  flags: NorthStarFeatureFlags,
  clinicId: string
): { run: boolean; sendReply: boolean; shadow: boolean } {
  switch (flags.mode) {
    case "full":
      return { run: true, sendReply: true, shadow: false };
    case "canary":
      if (flags.canaryClinicIds.includes(clinicId)) {
        return { run: true, sendReply: true, shadow: false };
      }
      return { run: false, sendReply: false, shadow: false };
    case "shadow":
      return { run: true, sendReply: false, shadow: true };
    case "off":
    default:
      return { run: false, sendReply: false, shadow: false };
  }
}

export function northStarDomainsEnabled(flags: NorthStarFeatureFlags): {
  faq: boolean;
  pricing: boolean;
  crm: boolean;
  handoff: boolean;
  booking: boolean;
} {
  const mode = flags.mode;
  return {
    faq: mode === "shadow" || mode === "canary" || mode === "full",
    pricing: mode === "shadow" || mode === "canary" || mode === "full",
    crm: mode === "canary" || mode === "full",
    handoff: mode === "canary" || mode === "full",
    booking: mode === "full",
  };
}
