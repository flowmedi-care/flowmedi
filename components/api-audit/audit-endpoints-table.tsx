"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAudit } from "./audit-context";
import type { AuditFilterState } from "./audit-filters";
import type { ApiEndpointDefinition, AuditTestResult } from "@/lib/api-audit/types";
import { cn } from "@/lib/utils";

const RISK_VARIANT: Record<string, string> = {
  critico: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  alto: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medio: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200 border-yellow-500/30",
  baixo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  informativo: "bg-muted text-muted-foreground",
};

const CATEGORY_LABEL: Record<string, string> = {
  publico: "Público",
  autenticado: "Autenticado",
  administrador: "Administrador",
  sistema: "Sistema",
  webhook: "Webhook",
  cron: "Cron",
};

interface AuditEndpointsTableProps {
  filters: AuditFilterState;
  onTest: (endpoint: ApiEndpointDefinition) => void;
}

function matchesFilters(
  ep: ApiEndpointDefinition,
  latest: AuditTestResult | undefined,
  filters: AuditFilterState
): boolean {
  const q = filters.search.trim().toLowerCase();
  if (q) {
    const hay = `${ep.name} ${ep.pathTemplate} ${ep.file}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.method !== "all" && ep.method !== filters.method) return false;
  if (filters.category !== "all" && ep.category !== filters.category) return false;
  if (filters.risk !== "all" && ep.auditRisk !== filters.risk) return false;
  if (filters.testStatus !== "all") {
    if (filters.testStatus === "untested" && latest) return false;
    if (filters.testStatus !== "untested" && latest?.classification !== filters.testStatus)
      return false;
  }
  return true;
}

function StatusBadge({ result }: { result?: AuditTestResult }) {
  if (!result) {
    return <Badge variant="outline">Não testado</Badge>;
  }
  if (result.skipped) {
    return <Badge variant="outline">Manual / Skip</Badge>;
  }
  const map = {
    aprovado: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    atencao: "bg-yellow-500/15 text-yellow-800 border-yellow-500/30",
    critico: "bg-red-500/15 text-red-700 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={map[result.classification]}>
      {result.status} · {result.classification}
    </Badge>
  );
}

function isSuspicious(ep: ApiEndpointDefinition, result?: AuditTestResult): boolean {
  if (!result || result.skipped) return ep.auditRisk === "critico";
  return (
    result.classification === "critico" ||
    result.flags.adminOpenWithoutAuth ||
    result.flags.privateOpenWithoutAuth ||
    result.flags.exposesStackTrace ||
    result.flags.exposesSensitiveData
  );
}

export function AuditEndpointsTable({ filters, onTest }: AuditEndpointsTableProps) {
  const { endpoints, getLatestResult } = useAudit();

  const filtered = endpoints.filter((ep) =>
    matchesFilters(ep, getLatestResult(ep.id), filters)
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Endpoint</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Auth</TableHead>
          <TableHead>Risco</TableHead>
          <TableHead>Último teste</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((ep) => {
          const latest = getLatestResult(ep.id);
          const suspicious = isSuspicious(ep, latest);
          return (
            <TableRow
              key={ep.id}
              className={cn(suspicious && "bg-destructive/5 hover:bg-destructive/10")}
            >
              <TableCell>
                <div className="font-medium">{ep.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{ep.pathTemplate}</div>
                <div className="text-xs text-muted-foreground">{ep.file}</div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{ep.method}</Badge>
              </TableCell>
              <TableCell>{CATEGORY_LABEL[ep.category] ?? ep.category}</TableCell>
              <TableCell className="text-xs">
                {ep.requiresAuth ? "Sim" : "Não"}
                {ep.requiredRoles.length > 0 && (
                  <div className="text-muted-foreground">{ep.requiredRoles.join(", ")}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={RISK_VARIANT[ep.auditRisk]}>
                  {ep.auditRisk}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge result={latest} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onTest(ep)}>
                  Testar
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
