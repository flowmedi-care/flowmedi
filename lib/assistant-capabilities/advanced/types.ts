export type AdvancedSettings = {
  linksManagedElsewhere: true;
};

export function advancedDefaults(): AdvancedSettings {
  return { linksManagedElsewhere: true };
}
