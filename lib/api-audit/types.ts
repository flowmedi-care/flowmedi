export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiCategory =
  | "publico"
  | "autenticado"
  | "administrador"
  | "sistema"
  | "webhook"
  | "cron";

export type AuditScenario =
  | "anonymous"
  | "current_session"
  | "cron_authenticated"
  | "admin"
  | "secretaria"
  | "medico"
  | "system_admin";

export type ProbeStrategy = "full" | "auth-only" | "manual" | "skip";

export type TestClassification = "aprovado" | "atencao" | "critico";

export type AuditRiskLevel = "critico" | "alto" | "medio" | "baixo" | "informativo";

export type SideEffect = "none" | "read" | "write";

export type AuthMechanism =
  | "none"
  | "helper-clinic-admin"
  | "helper-clinic-member"
  | "helper-clinic-member-role"
  | "helper-system-admin"
  | "getUser-admin"
  | "cron-secret"
  | "stripe-signature"
  | "meta-verify"
  | "meta-signature"
  | "service-role"
  | "edit-token"
  | "oauth-callback";

export interface AuditFixtures {
  clinicSlug: string;
  planId: string;
  conversationId: string;
  appointmentId: string;
  transcriptionId: string;
  formInstanceId: string;
  suggestionId: string;
  suggestionToken: string;
  clinicId: string;
  patientId: string;
  contactSlug: string;
  cronSecret: string;
  metaVerifyToken: string;
}

export interface ApiEndpointDefinition {
  id: string;
  name: string;
  method: HttpMethod;
  pathTemplate: string;
  file: string;
  category: ApiCategory;
  requiresAuth: boolean;
  requiresAuthorization: boolean;
  requiredRoles: string[];
  authMechanism: AuthMechanism;
  hasValidation: boolean;
  auditRisk: AuditRiskLevel;
  auditFindingIds: string[];
  probeStrategy: ProbeStrategy;
  expectedAnonymousStatus?: number | number[];
  expectedStatusByRole?: Partial<Record<AuditScenario, number | number[]>>;
  queryParams?: Record<string, string>;
  sampleBody?: unknown;
  sideEffects: SideEffect;
  notes?: string;
}

export interface AuditTestResult {
  endpointId: string;
  endpointName: string;
  method: HttpMethod;
  pathTemplate: string;
  resolvedPath: string;
  file: string;
  category: ApiCategory;
  scenario: AuditScenario;
  status: number;
  durationMs: number;
  ok: boolean;
  classification: TestClassification;
  problems: string[];
  recommendation: string;
  headers: Record<string, string>;
  responseSize: number;
  contentType: string | null;
  preview: string | null;
  flags: {
    exposesStackTrace: boolean;
    exposesSensitiveData: boolean;
    suspiciousCors: boolean;
    adminOpenWithoutAuth: boolean;
    privateOpenWithoutAuth: boolean;
  };
  skipped: boolean;
  skipReason?: string;
  testedAt: string;
}

export interface RegistryValidationResult {
  inSync: boolean;
  registryCount: number;
  filesystemCount: number;
  missingInRegistry: { file: string; method: HttpMethod; path: string }[];
  extraInRegistry: { id: string; file: string; method: HttpMethod; pathTemplate: string }[];
}

export interface AuditSessionInfo {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  role: string | null;
  clinicId: string | null;
}

export interface AuditConfigStatus {
  supabase: boolean;
  cronSecret: boolean;
  roleCredentials: {
    admin: boolean;
    secretaria: boolean;
    medico: boolean;
    system_admin: boolean;
  };
}

export interface AuditSummary {
  total: number;
  publicCount: number;
  privateCount: number;
  adminCount: number;
  tested: number;
  approved: number;
  failed: number;
  untested: number;
  critical: number;
  attention: number;
  executed: number;
  skippedConfig: number;
  skippedManual: number;
}

export interface AuditRunRequest {
  endpointIds?: string[];
  scenarios?: AuditScenario[];
  fixtures?: Partial<AuditFixtures>;
}

export interface AuditRunResponse {
  results: AuditTestResult[];
  summary: AuditSummary;
  completedAt: string;
}
