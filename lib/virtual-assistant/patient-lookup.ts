export function normalizePhoneForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

export function phonesMatch(patientPhone: string, incomingPhone: string): boolean {
  const pDigits = patientPhone.replace(/\D/g, "");
  const incoming = incomingPhone.replace(/\D/g, "");
  const normalized = normalizePhoneForMatch(incoming);
  if (!pDigits) return false;
  return pDigits === normalized || `55${pDigits}` === incoming;
}
