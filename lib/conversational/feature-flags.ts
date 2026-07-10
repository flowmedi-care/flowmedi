import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";

export type NorthStarMode = "off" | "shadow" | "canary" | "full";
export type NorthStarBrainVersion = "v1" | "v2";

export type NorthStarFeatureFlags = {
  mode: NorthStarMode;
  brain: NorthStarBrainVersion;
  /** Clínica piloto quando mode === canary */
  canaryClinicIds: string[];
  brainV2CanaryClinicIds: string[];
};

const DEFAULT_FLAGS: NorthStarFeatureFlags = {
  mode: "off",
  brain: "v1",
  canaryClinicIds: [],
  brainV2CanaryClinicIds: [],
};

export function northStarFlagsFromSettings(
  settings: Partial<VirtualAssistantSettings>
): NorthStarFeatureFlags {
  const raw = settings as Partial<VirtualAssistantSettings> & {
    north_star_enabled?: boolean;
    north_star_mode?: NorthStarMode;
    north_star_canary_clinic_ids?: string[];
    north_star_brain?: NorthStarBrainVersion;
    brain_v2_canary_clinic_ids?: string[];
  };

  if (raw.north_star_mode) {
    return {
      mode: raw.north_star_mode,
      brain: raw.north_star_brain ?? "v1",
      canaryClinicIds: raw.north_star_canary_clinic_ids ?? [],
      brainV2CanaryClinicIds: raw.brain_v2_canary_clinic_ids ?? [],
    };
  }

  if (raw.north_star_enabled === true) {
    return {
      mode: "full",
      brain: raw.north_star_brain ?? "v1",
      canaryClinicIds: [],
      brainV2CanaryClinicIds: raw.brain_v2_canary_clinic_ids ?? [],
    };
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

export function shouldUseBrainV2(
  flags: NorthStarFeatureFlags,
  clinicId: string
): boolean {
  if (flags.brain === "v2") return true;
  return flags.brainV2CanaryClinicIds.includes(clinicId);
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
