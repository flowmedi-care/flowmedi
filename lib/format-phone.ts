/**
 * Formata um número de telefone para exibição no padrão brasileiro:
 * (XX) XXXXX-XXXX para celular (11 dígitos) ou (XX) XXXX-XXXX para fixo (10 dígitos).
 * Retorna o valor original se não houver dígitos suficientes.
 */
export function formatPhoneBr(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  // Celular: (XX) XXXXX-XXXX
  if (digits.length >= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  // Fixo: (XX) XXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Aplica máscara de telefone enquanto o usuário digita (para inputs).
 * Retorna apenas dígitos para armazenamento; use formatPhoneBr para exibir.
 */
export function formatPhoneBrInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  // 11 dígitos: (XX) XXXXX-XXXX; 7–10: (XX) XXXX-XXXX
  if (digits.length >= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

/**
 * Extrai apenas os dígitos do telefone (para salvar no banco/envio).
 */
export function parsePhoneBr(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  return value.replace(/\D/g, "");
}
