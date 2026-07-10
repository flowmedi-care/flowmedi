export const CHANNELS = ["whatsapp", "instagram", "webchat"] as const;
export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}
