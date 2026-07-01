export function toMetaBodyVariableTokens(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) ?? [];
  return Array.from(new Set(matches));
}

export function stripMetaVariables(text: string): string {
  return text.replace(/\{\{\d+\}\}/g, "").trim();
}

export function validateMetaTemplateBody(text: string): {
  errors: string[];
  vars: string[];
  valid: boolean;
} {
  const trimmed = text.trim();
  const vars = toMetaBodyVariableTokens(trimmed);
  const uniqueVarNumbers = Array.from(
    new Set(
      vars.map((token) => Number(token.replace(/[^\d]/g, ""))).filter((n) => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);
  const plainLength = stripMetaVariables(trimmed).length;
  const errors: string[] = [];

  if (!trimmed) {
    errors.push("Corpo é obrigatório.");
    return { errors, vars, valid: false };
  }
  if (/^\s*\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}\s*$/.test(trimmed)) {
    errors.push("As variáveis não podem estar no início ou no fim do modelo.");
  }
  if (uniqueVarNumbers.length > 0) {
    const expected = Array.from({ length: uniqueVarNumbers.length }, (_, i) => i + 1);
    const sequential = expected.every((num, idx) => num === uniqueVarNumbers[idx]);
    if (!sequential) {
      errors.push("As variáveis devem seguir a sequência {{1}}, {{2}}, {{3}}...");
    }
  }
  if (vars.length > 0 && plainLength / vars.length < 22) {
    errors.push(
      "Este modelo contém muitas variáveis para sua extensão. Reduza o número de variáveis ou aumente a extensão da mensagem."
    );
  }
  if (vars.length > 10) {
    errors.push("A Meta permite no máximo 10 variáveis no corpo.");
  }
  return { errors, vars, valid: errors.length === 0 };
}

export function buildMetaBodyTextExample(bodyText: string, customRow?: string[]): string[][] {
  if (customRow && customRow.length > 0) {
    return [customRow];
  }
  const matches = bodyText.match(/\{\{\d+\}\}/g) ?? [];
  const count = Math.min(Math.max(matches.length, 1), 10);
  const sampleValues = [
    "Paciente",
    "Mensagem da clínica",
    "Equipe da clínica",
    "Informação adicional",
    "Detalhe",
    "Complemento",
    "Contexto",
    "Aviso",
    "Instrução",
    "Final",
  ];
  return [sampleValues.slice(0, count)];
}
