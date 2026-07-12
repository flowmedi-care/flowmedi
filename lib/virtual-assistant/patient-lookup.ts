export function normalizePhoneForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

/** Symmetric match — national vs 55-prefixed must be the same person. */
export function phonesMatch(patientPhone: string, incomingPhone: string): boolean {
  const a = normalizePhoneForMatch(patientPhone);
  const b = normalizePhoneForMatch(incomingPhone);
  return a.length > 0 && a === b;
}
