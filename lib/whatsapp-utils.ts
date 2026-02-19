/**
 * Normaliza número BR: 556296915034 -> 5562996915034 (adiciona 9 após DDD se faltar).
 * Evita conversas duplicadas com o mesmo número em formatos diferentes.
 */
export function normalizeWhatsAppPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("55")) {
    return d.slice(0, 4) + "9" + d.slice(4);
  }
  if (d.length === 11 && d.startsWith("55")) return "55" + d;
  return d;
}
