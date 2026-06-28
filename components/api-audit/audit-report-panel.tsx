"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAudit } from "./audit-context";
import {
  downloadTextFile,
  exportReportCsv,
  exportReportJson,
  exportReportMarkdown,
} from "@/lib/api-audit/export-report";

export function AuditReportPanel() {
  const { lastBatchResults } = useAudit();

  if (!lastBatchResults.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relatório</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Execute a auditoria completa para gerar o relatório.
        </CardContent>
      </Card>
    );
  }

  const critical = lastBatchResults.filter((r) => r.classification === "critico");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">
          Relatório ({lastBatchResults.length} testes · {critical.length} críticos)
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadTextFile(
                `api-audit-${Date.now()}.md`,
                exportReportMarkdown(lastBatchResults),
                "text/markdown"
              )
            }
          >
            Exportar Markdown
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadTextFile(
                `api-audit-${Date.now()}.json`,
                exportReportJson(lastBatchResults),
                "application/json"
              )
            }
          >
            Exportar JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadTextFile(
                `api-audit-${Date.now()}.csv`,
                exportReportCsv(lastBatchResults),
                "text/csv"
              )
            }
          >
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint</TableHead>
              <TableHead>Cenário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>Problema</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lastBatchResults.map((r) => (
              <TableRow
                key={`${r.endpointId}-${r.scenario}`}
                className={r.classification === "critico" ? "bg-destructive/5" : undefined}
              >
                <TableCell className="font-mono text-xs">{r.pathTemplate}</TableCell>
                <TableCell>{r.scenario}</TableCell>
                <TableCell>{r.status || "—"}</TableCell>
                <TableCell>{r.durationMs}ms</TableCell>
                <TableCell>{r.classification}</TableCell>
                <TableCell className="max-w-xs truncate text-xs">
                  {r.skipped ? r.skipReason : r.problems.join("; ") || r.recommendation}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
