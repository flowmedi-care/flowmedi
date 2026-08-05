export type CopyVariant = "A" | "B" | "C";

export function parseCopyVariant(raw: string | null | undefined): CopyVariant {
  const v = (raw ?? "A").toUpperCase();
  if (v === "B" || v === "C") return v;
  return "A";
}
