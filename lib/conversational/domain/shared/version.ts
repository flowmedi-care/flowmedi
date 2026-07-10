export type Version = number;

export function nextVersion(current: Version): Version {
  return current + 1;
}
