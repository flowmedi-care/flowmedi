"use client";

import { useEffect, useState } from "react";
import { AuditProvider } from "@/components/api-audit/audit-context";
import { AuditSummaryDashboard } from "@/components/api-audit/audit-summary-dashboard";
import { AuditRegistryAlert } from "@/components/api-audit/audit-registry-alert";
import { AuditConfigStatusPanel } from "@/components/api-audit/audit-config-status";
import { AuditSessionBanner } from "@/components/api-audit/audit-session-banner";
import { AuditFilters, type AuditFilterState } from "@/components/api-audit/audit-filters";
import { AuditEndpointsTable } from "@/components/api-audit/audit-endpoints-table";
import { AuditTestResultDialog } from "@/components/api-audit/audit-test-result-dialog";
import { AuditRunAllButton } from "@/components/api-audit/audit-run-all-button";
import { AuditReportPanel } from "@/components/api-audit/audit-report-panel";
import { FixturesPanel } from "@/components/api-audit/fixtures-panel";
import { useAudit } from "@/components/api-audit/audit-context";
import type { ApiEndpointDefinition } from "@/lib/api-audit/types";
import type { AuditFixtures } from "@/lib/api-audit/types";

function ApiValidationPanelInner() {
  const { setSession, setConfigStatus, configStatus } = useAudit();
  const [filters, setFilters] = useState<AuditFilterState>({
    search: "",
    method: "all",
    category: "all",
    risk: "all",
    testStatus: "all",
  });
  const [testEndpoint, setTestEndpoint] = useState<ApiEndpointDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/dev/audit/session")
      .then((r) => r.json())
      .then((data) => {
        const { configStatus: cfg, ...sess } = data;
        setSession(sess);
        setConfigStatus(cfg ?? null);
      })
      .catch(() => {
        setSession(null);
        setConfigStatus(null);
      });
  }, [setSession, setConfigStatus]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Validação de APIs</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Inventário completo da auditoria de segurança. Valide autenticação, autorização e
          exposição de dados antes de cada deploy. Disponível apenas com{" "}
          <code className="rounded bg-muted px-1">ENABLE_API_AUDIT_PANEL=true</code> na Vercel ou
          no <code className="rounded bg-muted px-1">.env.local</code>. Desative após a auditoria.
        </p>
      </header>

      <AuditRegistryAlert />
      <div className="grid gap-4 lg:grid-cols-2">
        <AuditConfigStatusPanel config={configStatus} />
        <AuditSessionBanner />
      </div>
      <AuditSummaryDashboard />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AuditRunAllButton />
      </div>

      <FixturesPanel />

      <AuditFilters filters={filters} onChange={setFilters} />

      <AuditEndpointsTable
        filters={filters}
        onTest={(ep) => {
          setTestEndpoint(ep);
          setDialogOpen(true);
        }}
      />

      <AuditReportPanel />

      <AuditTestResultDialog
        endpoint={testEndpoint}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </main>
  );
}

export function ApiValidationPanel({
  initialFixtures,
}: {
  initialFixtures: Partial<AuditFixtures>;
}) {
  return (
    <AuditProvider initialFixtures={initialFixtures}>
      <ApiValidationPanelInner />
    </AuditProvider>
  );
}
