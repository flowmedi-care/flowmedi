"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ApiEndpointDefinition,
  AuditConfigStatus,
  AuditFixtures,
  AuditSessionInfo,
  AuditSummary,
  AuditTestResult,
  RegistryValidationResult,
} from "@/lib/api-audit/types";
import { API_AUDIT_REGISTRY } from "@/lib/api-audit/registry";
import { FIXTURE_STORAGE_KEY } from "@/lib/api-audit/fixtures";

type ResultKey = string;

function resultKey(endpointId: string, scenario: string): ResultKey {
  return `${endpointId}::${scenario}`;
}

interface AuditContextValue {
  endpoints: ApiEndpointDefinition[];
  results: Map<ResultKey, AuditTestResult>;
  session: AuditSessionInfo | null;
  configStatus: AuditConfigStatus | null;
  registryValidation: RegistryValidationResult | null;
  fixtures: Partial<AuditFixtures>;
  isRunning: boolean;
  lastBatchResults: AuditTestResult[];
  lastBatchSummary: AuditSummary | null;
  setSession: (session: AuditSessionInfo | null) => void;
  setConfigStatus: (status: AuditConfigStatus | null) => void;
  setRegistryValidation: (v: RegistryValidationResult | null) => void;
  setFixtures: (fixtures: Partial<AuditFixtures>) => void;
  setResult: (result: AuditTestResult) => void;
  setBatchResults: (results: AuditTestResult[], summary?: AuditSummary | null) => void;
  setIsRunning: (v: boolean) => void;
  getLatestResult: (endpointId: string) => AuditTestResult | undefined;
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({
  children,
  initialFixtures,
}: {
  children: ReactNode;
  initialFixtures: Partial<AuditFixtures>;
}) {
  const [results, setResults] = useState<Map<ResultKey, AuditTestResult>>(() => {
    if (typeof window === "undefined") return new Map();
    try {
      const raw = sessionStorage.getItem("api-audit-results");
      if (!raw) return new Map();
      const parsed = JSON.parse(raw) as AuditTestResult[];
      return new Map(parsed.map((r) => [resultKey(r.endpointId, r.scenario), r]));
    } catch {
      return new Map();
    }
  });

  const [fixtures, setFixturesState] = useState<Partial<AuditFixtures>>(() => {
    if (typeof window === "undefined") return initialFixtures;
    try {
      const raw = localStorage.getItem(FIXTURE_STORAGE_KEY);
      if (raw) return { ...initialFixtures, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return initialFixtures;
  });

  const [session, setSession] = useState<AuditSessionInfo | null>(null);
  const [configStatus, setConfigStatus] = useState<AuditConfigStatus | null>(null);
  const [registryValidation, setRegistryValidation] =
    useState<RegistryValidationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastBatchResults, setLastBatchResults] = useState<AuditTestResult[]>([]);
  const [lastBatchSummary, setLastBatchSummary] = useState<AuditSummary | null>(null);

  const setFixtures = useCallback((next: Partial<AuditFixtures>) => {
    setFixturesState((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(FIXTURE_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const setResult = useCallback((result: AuditTestResult) => {
    setResults((prev) => {
      const next = new Map(prev);
      next.set(resultKey(result.endpointId, result.scenario), result);
      sessionStorage.setItem(
        "api-audit-results",
        JSON.stringify(Array.from(next.values()))
      );
      return next;
    });
  }, []);

  const setBatchResults = useCallback((batch: AuditTestResult[], summary?: AuditSummary | null) => {
    setLastBatchResults(batch);
    if (summary !== undefined) setLastBatchSummary(summary);
    setResults((prev) => {
      const next = new Map(prev);
      for (const r of batch) {
        next.set(resultKey(r.endpointId, r.scenario), r);
      }
      sessionStorage.setItem(
        "api-audit-results",
        JSON.stringify(Array.from(next.values()))
      );
      return next;
    });
  }, []);

  const getLatestResult = useCallback(
    (endpointId: string) => {
      const entries = Array.from(results.values()).filter(
        (r) => r.endpointId === endpointId
      );
      if (!entries.length) return undefined;
      return entries.sort(
        (a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime()
      )[0];
    },
    [results]
  );

  const value = useMemo(
    () => ({
      endpoints: API_AUDIT_REGISTRY,
      results,
      session,
      configStatus,
      registryValidation,
      fixtures,
      isRunning,
      lastBatchResults,
      lastBatchSummary,
      setSession,
      setConfigStatus,
      setRegistryValidation,
      setFixtures,
      setResult,
      setBatchResults,
      setIsRunning,
      getLatestResult,
    }),
    [
      results,
      session,
      configStatus,
      registryValidation,
      fixtures,
      isRunning,
      lastBatchResults,
      lastBatchSummary,
      setFixtures,
      setResult,
      setBatchResults,
      getLatestResult,
    ]
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}
