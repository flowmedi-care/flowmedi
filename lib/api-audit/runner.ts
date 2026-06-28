import { createServerClient } from "@supabase/ssr";
import { API_AUDIT_REGISTRY, getEndpointById } from "./registry";
import { loadFixturesFromEnv, loadRoleCredentials } from "./fixtures";
import { resolveEndpointPath, getRequestOrigin } from "./resolve-path";
import { buildResponsePreview, pickResponseHeaders } from "./redact";
import { analyzeTestResult, computeFlags } from "./analyzer";
import type {
  ApiEndpointDefinition,
  AuditFixtures,
  AuditRunRequest,
  AuditRunResponse,
  AuditScenario,
  AuditSessionInfo,
  AuditSummary,
  AuditTestResult,
} from "./types";

const PROBE_TIMEOUT_MS = 30_000;
const BATCH_DELAY_MS = 100;

type CookiePair = { name: string; value: string };

async function getCookieHeaderForRole(role: string): Promise<string | null> {
  const creds = loadRoleCredentials(role);
  if (!creds) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const jar: CookiePair[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.map((c) => ({ name: c.name, value: c.value })),
      setAll: (cookies) => {
        for (const c of cookies) {
          const idx = jar.findIndex((x) => x.name === c.name);
          if (idx >= 0) jar[idx] = { name: c.name, value: c.value };
          else jar.push({ name: c.name, value: c.value });
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) return null;
  return jar.map((c) => `${c.name}=${c.value}`).join("; ");
}

function buildAuthHeaders(
  endpoint: ApiEndpointDefinition,
  scenario: AuditScenario,
  fixtures: AuditFixtures,
  cookieHeader: string | null
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Api-Audit-Probe": "1",
  };

  if (endpoint.authMechanism === "cron-secret" && fixtures.cronSecret) {
    headers.Authorization = `Bearer ${fixtures.cronSecret}`;
  }

  if (cookieHeader && scenario !== "anonymous") {
    headers.Cookie = cookieHeader;
  }

  return headers;
}

function buildRequestBody(
  endpoint: ApiEndpointDefinition,
  fixtures: AuditFixtures,
  strategy: ApiEndpointDefinition["probeStrategy"]
): string | undefined {
  if (endpoint.method === "GET" || endpoint.method === "DELETE") return undefined;
  if (strategy === "auth-only") {
    return JSON.stringify({});
  }
  if (endpoint.sampleBody !== undefined) {
    return JSON.stringify(endpoint.sampleBody);
  }
  if (endpoint.pathTemplate.includes("process-public-form-event")) {
    return JSON.stringify({ form_instance_id: fixtures.formInstanceId });
  }
  return JSON.stringify({});
}

export async function getAuditSession(cookieHeader: string | null): Promise<AuditSessionInfo> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !cookieHeader) {
    return { authenticated: false, userId: null, email: null, role: null, clinicId: null };
  }

  const jar: CookiePair[] = cookieHeader.split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return { name, value: rest.join("=") };
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.map((c) => ({ name: c.name, value: c.value })),
      setAll: () => {},
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { authenticated: false, userId: null, email: null, role: null, clinicId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();

  return {
    authenticated: true,
    userId: user.id,
    email: user.email ?? null,
    role: profile?.role ?? null,
    clinicId: profile?.clinic_id ?? null,
  };
}

export async function probeEndpoint(
  endpoint: ApiEndpointDefinition,
  scenario: AuditScenario,
  options: {
    origin: string;
    fixtures: AuditFixtures;
    requestCookieHeader?: string | null;
    roleCookieHeader?: string | null;
  }
): Promise<AuditTestResult> {
  const testedAt = new Date().toISOString();

  if (endpoint.probeStrategy === "manual" || endpoint.probeStrategy === "skip") {
    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      method: endpoint.method,
      pathTemplate: endpoint.pathTemplate,
      resolvedPath: endpoint.pathTemplate,
      file: endpoint.file,
      category: endpoint.category,
      scenario,
      status: 0,
      durationMs: 0,
      ok: false,
      classification: "atencao",
      problems: [],
      recommendation: endpoint.notes ?? "Teste manual necessário (webhook OAuth, assinatura externa).",
      headers: {},
      responseSize: 0,
      contentType: null,
      preview: null,
      flags: {
        exposesStackTrace: false,
        exposesSensitiveData: false,
        suspiciousCors: false,
        adminOpenWithoutAuth: false,
        privateOpenWithoutAuth: false,
      },
      skipped: true,
      skipReason: endpoint.probeStrategy === "skip" ? "Marcado como skip" : "Teste manual",
      testedAt,
    };
  }

  const resolvedPath = resolveEndpointPath(endpoint, options.fixtures);
  const url = `${options.origin}${resolvedPath}`;

  let cookieHeader: string | null = null;
  if (scenario === "anonymous") {
    cookieHeader = null;
  } else if (scenario === "current_session") {
    cookieHeader = options.requestCookieHeader ?? null;
  } else {
    cookieHeader = options.roleCookieHeader ?? (await getCookieHeaderForRole(scenario));
    if (!cookieHeader) {
      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        method: endpoint.method,
        pathTemplate: endpoint.pathTemplate,
        resolvedPath,
        file: endpoint.file,
        category: endpoint.category,
        scenario,
        status: 0,
        durationMs: 0,
        ok: false,
        classification: "atencao",
        problems: [`Credenciais não configuradas para papel ${scenario}`],
        recommendation: `Defina API_AUDIT_${scenario.toUpperCase()}_EMAIL/PASSWORD no .env.local`,
        headers: {},
        responseSize: 0,
        contentType: null,
        preview: null,
        flags: {
          exposesStackTrace: false,
          exposesSensitiveData: false,
          suspiciousCors: false,
          adminOpenWithoutAuth: false,
          privateOpenWithoutAuth: false,
        },
        skipped: true,
        skipReason: "Credenciais ausentes",
        testedAt,
      };
    }
  }

  const headers = buildAuthHeaders(endpoint, scenario, options.fixtures, cookieHeader);
  const body = buildRequestBody(endpoint, options.fixtures, endpoint.probeStrategy);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers: {
        ...headers,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const durationMs = Date.now() - start;
    const text = await response.text();
    const contentType = response.headers.get("content-type");
    const pickedHeaders = pickResponseHeaders(response.headers);
    const { preview, exposesStackTrace, exposesSensitiveData } = buildResponsePreview(
      text,
      contentType
    );

    const flags = computeFlags(
      endpoint,
      scenario,
      response.status,
      text.length,
      pickedHeaders["access-control-allow-origin"] ?? null,
      exposesStackTrace,
      exposesSensitiveData
    );

    const problems: string[] = [];
    const { classification, recommendation } = analyzeTestResult(
      endpoint,
      scenario,
      response.status,
      text.length,
      flags,
      problems
    );

    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      method: endpoint.method,
      pathTemplate: endpoint.pathTemplate,
      resolvedPath,
      file: endpoint.file,
      category: endpoint.category,
      scenario,
      status: response.status,
      durationMs,
      ok: response.ok,
      classification,
      problems,
      recommendation,
      headers: pickedHeaders,
      responseSize: text.length,
      contentType,
      preview: preview && !exposesSensitiveData ? preview : preview ? "[Preview oculta — dados sensíveis detectados]" : null,
      flags,
      skipped: false,
      testedAt,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      method: endpoint.method,
      pathTemplate: endpoint.pathTemplate,
      resolvedPath,
      file: endpoint.file,
      category: endpoint.category,
      scenario,
      status: 0,
      durationMs,
      ok: false,
      classification: "critico",
      problems: [`Falha na requisição: ${message}`],
      recommendation: "Verifique se o servidor está rodando e se fixtures/URL estão corretos.",
      headers: {},
      responseSize: 0,
      contentType: null,
      preview: null,
      flags: {
        exposesStackTrace: false,
        exposesSensitiveData: false,
        suspiciousCors: false,
        adminOpenWithoutAuth: false,
        privateOpenWithoutAuth: false,
      },
      skipped: false,
      testedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function defaultScenarios(): AuditScenario[] {
  return ["anonymous", "current_session", "admin", "secretaria", "medico", "system_admin"];
}

export function computeSummary(
  results: AuditTestResult[],
  registryTotal: number
): AuditSummary {
  const testedIds = new Set(results.filter((r) => !r.skipped).map((r) => r.endpointId));
  const approved = results.filter((r) => !r.skipped && r.classification === "aprovado").length;
  const failed = results.filter(
    (r) => !r.skipped && (r.classification === "critico" || r.classification === "atencao")
  ).length;

  const publicCount = API_AUDIT_REGISTRY.filter((x) => x.category === "publico").length;
  const adminCount = API_AUDIT_REGISTRY.filter(
    (x) => x.category === "administrador" || x.category === "sistema"
  ).length;
  const privateCount = API_AUDIT_REGISTRY.filter(
    (x) => x.requiresAuth && x.category !== "cron" && x.category !== "webhook"
  ).length;

  return {
    total: registryTotal,
    publicCount,
    privateCount,
    adminCount,
    tested: testedIds.size,
    approved,
    failed,
    untested: registryTotal - testedIds.size,
    critical: results.filter((r) => r.classification === "critico").length,
    attention: results.filter((r) => r.classification === "atencao").length,
  };
}

export async function runAuditBatch(
  request: AuditRunRequest,
  options: {
    origin: string;
    requestCookieHeader?: string | null;
    fixtureOverrides?: Partial<AuditFixtures>;
  }
): Promise<AuditRunResponse> {
  const fixtures = loadFixturesFromEnv(options.fixtureOverrides);
  const scenarios = request.scenarios ?? defaultScenarios();
  const endpoints = request.endpointIds
    ? request.endpointIds
        .map(getEndpointById)
        .filter((x): x is ApiEndpointDefinition => !!x)
    : API_AUDIT_REGISTRY;

  const roleCookieCache = new Map<string, string | null>();
  const results: AuditTestResult[] = [];

  for (const endpoint of endpoints) {
    for (const scenario of scenarios) {
      if (scenario !== "anonymous" && scenario !== "current_session") {
        if (!roleCookieCache.has(scenario)) {
          roleCookieCache.set(scenario, await getCookieHeaderForRole(scenario));
        }
      }

      const result = await probeEndpoint(endpoint, scenario, {
        origin: options.origin,
        fixtures,
        requestCookieHeader: options.requestCookieHeader,
        roleCookieHeader: roleCookieCache.get(scenario) ?? null,
      });
      results.push(result);
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return {
    results,
    summary: computeSummary(results, API_AUDIT_REGISTRY.length),
    completedAt: new Date().toISOString(),
  };
}

export function getRequestOriginFromHeaders(host: string | null, proto: string | null): string {
  if (host) {
    const scheme = proto ?? "http";
    return `${scheme}://${host}`.replace(/\/$/, "");
  }
  return getRequestOrigin(null);
}
