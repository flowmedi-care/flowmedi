/** Política de senha — LGPD art. 46 (segurança). Mínimo 8 caracteres, letra e número. */

export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "A senha deve conter pelo menos uma letra.";
  }
  if (!/[0-9]/.test(password)) {
    return "A senha deve conter pelo menos um número.";
  }
  return null;
}

export const PASSWORD_HINT =
  `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`;
