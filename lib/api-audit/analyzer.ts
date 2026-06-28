import type {
  ApiEndpointDefinition,
  AuditScenario,
  AuditTestResult,
  TestClassification,
} from "./types";

function statusMatches(expected: number | number[] | undefined, actual: number): boolean {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) return expected.includes(actual);
  return expected === actual;
}

export function analyzeTestResult(
  endpoint: ApiEndpointDefinition,
  scenario: AuditScenario,
  status: number,
  responseSize: number,
  flags: AuditTestResult["flags"],
  problems: string[]
): { classification: TestClassification; recommendation: string } {
  const isAnonymous = scenario === "anonymous";
  const isAdminCategory = endpoint.category === "administrador" || endpoint.category === "sistema";

  if (flags.adminOpenWithoutAuth) {
    problems.push("Endpoint administrativo/sistema respondeu sem autenticação");
  }
  if (flags.privateOpenWithoutAuth) {
    problems.push("Endpoint privado retornou 200 sem autenticação");
  }
  if (flags.exposesStackTrace) {
    problems.push("Resposta contém stack trace ou campo debug");
  }
  if (flags.exposesSensitiveData) {
    problems.push("Resposta pode conter dados sensíveis (PII/tokens)");
  }
  if (flags.suspiciousCors) {
    problems.push("CORS permissivo (Access-Control-Allow-Origin: *) em endpoint privado");
  }

  if (endpoint.auditRisk === "critico" && isAnonymous && status === 200 && responseSize > 50) {
    problems.push(`Risco crítico da auditoria (${endpoint.auditFindingIds.join(", ") || "N/A"})`);
  }

  if (isAnonymous && endpoint.expectedAnonymousStatus !== undefined) {
    if (!statusMatches(endpoint.expectedAnonymousStatus, status)) {
      problems.push(
        `Status ${status} diverge do esperado para anônimo: ${JSON.stringify(endpoint.expectedAnonymousStatus)}`
      );
    }
  }

  if (endpoint.expectedStatusByRole?.[scenario] !== undefined) {
    if (!statusMatches(endpoint.expectedStatusByRole[scenario], status)) {
      problems.push(
        `Status ${status} diverge do esperado para ${scenario}: ${JSON.stringify(endpoint.expectedStatusByRole[scenario])}`
      );
    }
  }

  let classification: TestClassification = "aprovado";
  let recommendation = "Comportamento dentro do esperado para este cenário.";

  const hasCritical =
    flags.adminOpenWithoutAuth ||
    flags.privateOpenWithoutAuth ||
    (endpoint.auditRisk === "critico" && isAnonymous && status === 200 && responseSize > 100) ||
    (flags.exposesStackTrace && status >= 500);

  const hasAttention =
    problems.length > 0 ||
    flags.exposesSensitiveData ||
    flags.suspiciousCors ||
    (isAnonymous && isAdminCategory && status < 400);

  if (hasCritical) {
    classification = "critico";
    recommendation = "Corrigir antes do deploy. Revise autenticação, autorização e exposição de dados.";
  } else if (hasAttention) {
    classification = "atencao";
    recommendation = "Revisar manualmente. Pode ser falso positivo se fixtures estiverem incorretas.";
  }

  return { classification, recommendation };
}

export function computeFlags(
  endpoint: ApiEndpointDefinition,
  scenario: AuditScenario,
  status: number,
  responseSize: number,
  corsHeader: string | null,
  exposesStackTrace: boolean,
  exposesSensitiveData: boolean
): AuditTestResult["flags"] {
  const isAnonymous = scenario === "anonymous";
  const isAdminCategory = endpoint.category === "administrador" || endpoint.category === "sistema";

  return {
    exposesStackTrace,
    exposesSensitiveData,
    suspiciousCors:
      !!corsHeader &&
      corsHeader.includes("*") &&
      endpoint.requiresAuth &&
      endpoint.category !== "publico",
    adminOpenWithoutAuth: isAnonymous && isAdminCategory && status === 200 && responseSize > 0,
    privateOpenWithoutAuth:
      isAnonymous && endpoint.requiresAuth && status === 200 && responseSize > 50,
  };
}
