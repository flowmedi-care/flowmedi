/** Normaliza CPF para apenas dígitos (11 chars). Retorna null se inválido. */
export function normalizeCpf(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

/** Tenta extrair CPF de texto livre (com ou sem formatação). */
export function extractCpfFromText(text: string): string | null {
  const trimmed = text.trim();
  const labeled = trimmed.match(
    /\b(?:cpf)\s*[:\-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})\b/i
  );
  if (labeled?.[1]) return normalizeCpf(labeled[1]);

  const bare = trimmed.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})\b/);
  if (bare?.[1]) return normalizeCpf(bare[1]);

  return null;
}

export function isValidCpfDigits(cpf: string): boolean {
  return /^\d{11}$/.test(cpf);
}
