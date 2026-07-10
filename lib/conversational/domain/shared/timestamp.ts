export type Timestamp = string;

export function nowTimestamp(): Timestamp {
  return new Date().toISOString();
}
