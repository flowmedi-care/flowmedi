import type { ApiEndpointDefinition, AuditFixtures } from "./types";

export function resolveEndpointPath(
  endpoint: ApiEndpointDefinition,
  fixtures: AuditFixtures
): string {
  let path = endpoint.pathTemplate;

  const replacements: Record<string, string> = {
    slug: fixtures.clinicSlug,
    id: fixtures.planId,
    token: fixtures.suggestionToken,
    transcriptionId: fixtures.transcriptionId,
    conversationId: fixtures.conversationId,
  };

  for (const [key, value] of Object.entries(replacements)) {
    path = path.replace(`[${key}]`, encodeURIComponent(value));
  }

  if (endpoint.queryParams) {
    const params = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(endpoint.queryParams)) {
      let value = rawValue;
      const placeholderMap: Record<string, string> = {
        clinicSlug: fixtures.clinicSlug,
        planId: fixtures.planId,
        conversationId: fixtures.conversationId,
        appointmentId: fixtures.appointmentId,
        transcriptionId: fixtures.transcriptionId,
        formInstanceId: fixtures.formInstanceId,
        suggestionId: fixtures.suggestionId,
        suggestionToken: fixtures.suggestionToken,
        clinicId: fixtures.clinicId,
        patientId: fixtures.patientId,
        metaVerifyToken: fixtures.metaVerifyToken,
        cronSecret: fixtures.cronSecret,
      };
      for (const [placeholder, replacement] of Object.entries(placeholderMap)) {
        value = value.replace(`{${placeholder}}`, replacement);
      }
      params.set(key, value);
    }
    const qs = params.toString();
    if (qs) path += `?${qs}`;
  }

  return path;
}

export function getRequestOrigin(requestOrigin?: string | null): string {
  if (requestOrigin?.trim()) return requestOrigin.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
